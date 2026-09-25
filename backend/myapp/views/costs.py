from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from ..models import Product, InventoryItem, InventoryLog, OperatingExpense, WasteRecord

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperatingExpense
        fields = '__all__'
        read_only_fields = ['id','created_at','voided']
        extra_kwargs = {'request_id': {'validators': []}, 'amount': {'min_value': Decimal('0.01')}}
    def validate_date(self, value):
        if value > timezone.localdate():
            raise ValidationError('Record expenses already incurred, not future estimates.')
        return value

class WasteInput(serializers.Serializer):
    request_id = serializers.UUIDField()
    inventory_item = serializers.IntegerField(min_value=1)
    quantity = serializers.DecimalField(max_digits=12,decimal_places=3,min_value=Decimal('0.001'))
    reason = serializers.CharField(max_length=300)

@api_view(['GET','POST'])
@permission_classes([IsAdminUser])
def expenses(request):
    if request.method == 'POST':
        serializer=ExpenseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            existing=OperatingExpense.objects.filter(request_id=serializer.validated_data['request_id']).first()
            if existing and any(getattr(existing, key) != value for key,value in serializer.validated_data.items()):
                raise ValidationError('This request was already recorded with different details. Refresh before entering a new expense.')
            row=existing or serializer.save()
        return Response(ExpenseSerializer(row).data,status=200 if existing else 201)
    return Response(ExpenseSerializer(OperatingExpense.objects.order_by('-date','-id')[:100],many=True).data)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def void_expense(request, pk):
    row=get_object_or_404(OperatingExpense,pk=pk)
    row.voided=True
    row.save(update_fields=['voided'])
    return Response(ExpenseSerializer(row).data)

@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def record_waste(request):
    serializer=WasteInput(data=request.data);serializer.is_valid(raise_exception=True)
    data=serializer.validated_data
    User.objects.select_for_update().get(pk=request.user.pk)
    old=WasteRecord.objects.filter(request_id=data['request_id']).first()
    if old:
        if old.inventory_item_id != data['inventory_item'] or old.quantity != data['quantity'] or old.reason != data['reason']:
            raise ValidationError('This request was already recorded with different details. Refresh before recording new wastage.')
        return Response({'id':old.pk,'detail':'Already recorded.'})
    lot=get_object_or_404(InventoryItem.objects.select_for_update(),pk=data['inventory_item'])
    if data['quantity'] > lot.quantity:
        raise ValidationError('Waste quantity exceeds the stock remaining in this batch.')
    cost=(lot.unit_cost*data['quantity']).quantize(Decimal('0.01')) if lot.unit_cost is not None else None
    lot.quantity-=data['quantity'];lot.save(update_fields=['quantity','updated_at'])
    row=WasteRecord.objects.create(inventory_item=lot,quantity=data['quantity'],reason=data['reason'],estimated_cost=cost,request_id=data['request_id'])
    InventoryLog.objects.create(inventory_item=lot,change=-data['quantity'],reason='Waste: '+data['reason'][:240],reference='Waste #'+str(row.pk),admin=request.user)
    return Response({'id':row.pk,'detail':'Waste recorded and stock deducted.'},status=201)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def cost_report(request):
    today=timezone.localdate()
    field=serializers.DateField()
    start=field.run_validation(request.query_params.get('start',str(today-timedelta(days=27))))
    end=field.run_validation(request.query_params.get('end',str(today)))
    if start>end or (end-start).days>366:
        raise ValidationError('Choose a date range of up to 367 days, with start before end.')
    menus=[]
    for p in Product.objects.prefetch_related('ingredients__raw_material').order_by('name'):
        recipe=list(p.ingredients.all())
        missing=[i.raw_material.name for i in recipe if i.raw_material.estimated_unit_cost is None]
        if not recipe: missing.append('Recipe not recorded')
        if p.packaging_cost is None: missing.append('Packaging cost')
        ingredient=sum((i.quantity_required*i.raw_material.estimated_unit_cost for i in recipe if i.raw_material.estimated_unit_cost is not None),Decimal('0'))
        total=ingredient+p.packaging_cost if not missing else None
        contribution=p.price-total if total is not None else None
        menus.append({'id':p.pk,'name':p.name,'price':str(p.price),'missing':missing,
            'ingredient_cost':str(ingredient.quantize(Decimal('0.01'))) if recipe and not any(i.raw_material.estimated_unit_cost is None for i in recipe) else None,
            'packaging_cost':str(p.packaging_cost) if p.packaging_cost is not None else None,
            'estimated_contribution':str(contribution.quantize(Decimal('0.01'))) if contribution is not None else None,
            'estimated_margin_percent':str((contribution/p.price*100).quantize(Decimal('0.1'))) if contribution is not None and p.price>0 else None})
    costs=OperatingExpense.objects.filter(date__range=(start,end),voided=False)
    waste=WasteRecord.objects.filter(created_at__date__range=(start,end))
    return Response({'start':str(start),'end':str(end),'menus':menus,
        'operating_expenses':str(costs.aggregate(total=Sum('amount'))['total'] or Decimal('0')),
        'known_waste_cost':str(waste.aggregate(total=Sum('estimated_cost'))['total'] or Decimal('0')),
        'unpriced_waste_records':waste.filter(estimated_cost__isnull=True).count(),
        'waste':[{'id':w.pk,'material':w.inventory_item.raw_material.name,'quantity':str(w.quantity),'unit':w.inventory_item.raw_material.unit,'reason':w.reason,'cost':str(w.estimated_cost) if w.estimated_cost is not None else None,'date':w.created_at.date().isoformat()} for w in waste.select_related('inventory_item__raw_material').order_by('-created_at')[:100]]})
