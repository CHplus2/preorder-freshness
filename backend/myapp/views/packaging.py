"""Staff-only packaging catalogue, menu mappings and stock movement history."""
from django.db import transaction, IntegrityError
from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import PackagingItem, ProductPackaging, PackagingMovement, Product


class Conflict(APIException):
    status_code = 409
    default_detail = 'This record changed. Refresh before saving again.'


class StrictInput(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise ValidationError({'non_field_errors': ['Use only the fields shown in this form.']})
        return super().to_internal_value(data)


class ItemInput(StrictInput):
    name = serializers.CharField(max_length=100)
    reorder_level = serializers.IntegerField(min_value=0, max_value=1000000)
    unit_cost = serializers.DecimalField(max_digits=14, decimal_places=6, min_value=0, allow_null=True)
    is_active = serializers.BooleanField(default=True)

    def validate_name(self, name):
        name = ' '.join(name.split())
        if not name:
            raise ValidationError('Enter a packaging name.')
        qs = PackagingItem.objects.filter(name__iexact=name)
        if self.context.get('pk'):
            qs = qs.exclude(pk=self.context['pk'])
        if qs.exists():
            raise ValidationError('That packaging item already exists. Update its stock instead.')
        return name


class NewItemInput(ItemInput):
    quantity = serializers.IntegerField(min_value=0, max_value=1000000)
    request_id = serializers.UUIDField()


class EditItemInput(ItemInput):
    expected_updated_at = serializers.DateTimeField()


class MovementInput(StrictInput):
    change = serializers.IntegerField(min_value=-1000000, max_value=1000000)
    reason = serializers.CharField(max_length=200)
    request_id = serializers.UUIDField()
    expected_updated_at = serializers.DateTimeField()

    def validate_change(self, value):
        if value == 0:
            raise ValidationError('Enter a quantity other than zero.')
        return value


class RequirementInput(StrictInput):
    packaging_item = serializers.IntegerField(min_value=1)
    quantity_per_item = serializers.IntegerField(min_value=1, max_value=1000)


class MappingInput(StrictInput):
    expected_updated_at = serializers.DateTimeField()
    requirements = RequirementInput(many=True, max_length=30)

    def validate_requirements(self, value):
        ids = [v['packaging_item'] for v in value]
        if len(ids) != len(set(ids)):
            raise ValidationError('Choose each packaging item once.')
        return value


def record(item):
    return dict(id=item.pk, name=item.name, quantity=item.quantity, reorder_level=item.reorder_level,
        unit_cost=str(item.unit_cost) if item.unit_cost is not None else None,
        is_active=item.is_active, low_stock=item.is_active and item.quantity <= item.reorder_level,
        updated_at=item.updated_at.isoformat(), menu_count=item.menu_count if hasattr(item, 'menu_count') else item.menu_requirements.count())


def version(instance, expected):
    if instance.updated_at != expected:
        raise Conflict()


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def packaging_items(request):
    if request.method == 'GET':
        return Response([record(p) for p in PackagingItem.objects.annotate(menu_count=Count('menu_requirements'))])
    return create_item(request)


@transaction.atomic
def create_item(request):
    if not isinstance(request.data, dict):
        raise ValidationError('Use the packaging form fields.')
    # Serialize name creation and opening-stock retry identities across staff.
    from ..models import Storefront
    Storefront.objects.get_or_create(pk=1)
    Storefront.objects.select_for_update().get(pk=1)
    key = serializers.UUIDField().run_validation(request.data.get('request_id'))
    previous = PackagingMovement.objects.filter(request_id=key).select_related('packaging_item').first()
    if previous:
        if (previous.actor_id != request.user.pk or previous.kind != 'opening'
                or previous.change != serializers.IntegerField(min_value=0, max_value=1000000).run_validation(request.data.get('quantity'))
                or previous.packaging_item.name != ' '.join(str(request.data.get('name', '')).split())):
            raise Conflict('This save reference has already been used. Refresh and start again.')
        return Response(record(previous.packaging_item))
    form = NewItemInput(data=request.data)
    form.is_valid(raise_exception=True)
    values = dict(form.validated_data)
    values.pop('request_id')
    try:
        with transaction.atomic():
            item = PackagingItem.objects.create(**values)
    except IntegrityError:
        raise ValidationError({'name': ['That packaging name is already in use. Refresh stock records.']})
    PackagingMovement.objects.create(packaging_item=item, request_id=key, kind='opening',
        change=item.quantity, balance_after=item.quantity, reason='Opening stock', actor=request.user)
    return Response(record(item), status=201)


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
@transaction.atomic
def packaging_item(request, pk):
    item = get_object_or_404(PackagingItem.objects.select_for_update(), pk=pk)
    form = EditItemInput(data=request.data, context={'pk': pk})
    form.is_valid(raise_exception=True)
    values = dict(form.validated_data)
    version(item, values.pop('expected_updated_at'))
    for key, value in values.items():
        setattr(item, key, value)
    try:
        with transaction.atomic():
            item.save()
    except IntegrityError:
        raise ValidationError({'name': ['That packaging name is already in use. Refresh stock records.']})
    return Response(record(item))


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def packaging_movements(request, pk):
    item = get_object_or_404(PackagingItem, pk=pk)
    if request.method == 'GET':
        before = request.query_params.get('before')
        if set(request.query_params) - {'before'} or any(len(v) != 1 for _, v in request.query_params.lists()):
            raise ValidationError('Use one optional before movement ID.')
        rows = item.movements.select_related('order_packaging__order_item')
        if before is not None:
            rows = rows.filter(pk__lt=serializers.IntegerField(min_value=1, max_value=9007199254740991).run_validation(before))
        page = list(rows[:51]);more = len(page) > 50;page = page[:50]
        return Response(dict(results=[dict(id=row.pk, kind=row.kind, change=row.change,
            balance_after=row.balance_after, reason=row.reason, created_at=row.created_at,
            order_id=row.order_packaging.order_item.order_id if row.order_packaging_id else None)
            for row in page], next_before=page[-1].pk if more else None))
    return write_movement(request, pk)


@transaction.atomic
def write_movement(request, pk):
    item = get_object_or_404(PackagingItem.objects.select_for_update(), pk=pk)
    form = MovementInput(data=request.data)
    form.is_valid(raise_exception=True)
    v = form.validated_data
    previous = PackagingMovement.objects.filter(request_id=v['request_id']).first()
    if previous:
        if (previous.packaging_item_id, previous.actor_id, previous.change, previous.reason, previous.kind) != (
                item.pk, request.user.pk, v['change'], v['reason'], 'receive' if v['change'] > 0 else 'adjust'):
            raise Conflict('This stock reference has already been used. Refresh and start again.')
        return Response(record(item))
    version(item, v['expected_updated_at'])
    if not 0 <= item.quantity + v['change'] <= 1000000000:
        raise ValidationError('This adjustment would put stock below zero or above the supported total.')
    item.quantity += v['change']
    item.save(update_fields=['quantity', 'updated_at'])
    try:
        with transaction.atomic():
            PackagingMovement.objects.create(packaging_item=item, change=v['change'], balance_after=item.quantity,
                kind='receive' if v['change'] > 0 else 'adjust', reason=v['reason'], request_id=v['request_id'], actor=request.user)
    except IntegrityError:
        # The outer transaction also rolls back the quantity written above.
        raise Conflict('This stock reference was used by another request. Refresh the stock history.')
    return Response(record(item))


@api_view(['GET'])
@permission_classes([IsAdminUser])
def packaging_menus(request):
    menus = Product.objects.prefetch_related('packaging_requirements').order_by('name', 'id')
    return Response([dict(id=p.pk, name=p.name, selling_status=p.selling_status, updated_at=p.updated_at.isoformat(),
        requirements=[dict(packaging_item=r.packaging_item_id, quantity_per_item=r.quantity_per_item)
                      for r in p.packaging_requirements.all()]) for p in menus])


@api_view(['PUT'])
@permission_classes([IsAdminUser])
@transaction.atomic
def menu_packaging(request, pk):
    # Same menu lock as checkout: a save cannot change a partly captured mapping.
    menu = get_object_or_404(Product.objects.select_for_update(), pk=pk)
    form = MappingInput(data=request.data)
    form.is_valid(raise_exception=True)
    v = form.validated_data
    version(menu, v['expected_updated_at'])
    ids = {r['packaging_item'] for r in v['requirements']}
    if PackagingItem.objects.filter(pk__in=ids, is_active=True).count() != len(ids):
        raise ValidationError('Choose available packaging items. Refresh if an item was archived.')
    menu.packaging_requirements.all().delete()
    ProductPackaging.objects.bulk_create([ProductPackaging(product=menu, packaging_item_id=r['packaging_item'],
        quantity_per_item=r['quantity_per_item']) for r in v['requirements']])
    menu.save(update_fields=['updated_at'])
    return Response(dict(id=menu.pk, updated_at=menu.updated_at.isoformat(), requirements=v['requirements']))
