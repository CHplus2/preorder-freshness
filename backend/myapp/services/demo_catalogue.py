"""Explicit, one-time rewrite of owner-confirmed fictional demo records.

Not an HTTP endpoint or a normal release operation. Unsupported wallets or
structured consumption stop the entire transaction before any data changes.
"""
import hashlib
import json
from decimal import Decimal

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from rest_framework.exceptions import ValidationError

from scripts.import_dapur_kita import index_names, menu_payload, validate_source
from ..models import (Category, RawMaterial, Product, ProductIngredient, Order,
    OrderItem, OrderIngredient, PaymentEvent, IngredientConsumption, OrderAmendment)
from ..serializers import ProductSerializer, RawMaterialSerializer
from .commitments import preparation_snapshot

ORDER_GUARD_FIELDS = ('id', 'total_amount', 'discount_amount', 'shipping_fee',
    'status', 'payment_status', 'payment_method', 'inventory_deducted')
ITEM_GUARD_FIELDS = ('id', 'product', 'product_name', 'quantity', 'unit_price', 'subtotal')
BACKUP_ORDER_FIELDS = ('total_amount', 'inventory_deducted', 'preparation_at',
    'preparation_end_at', 'preparation_plan')
KIND = 'dapur_kita_demo_recast'


def json_safe(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def history_fingerprint(rows):
    """Same representation for staff API snapshots and ORM reads; no user data."""
    normalized = []
    for order in sorted(rows, key=lambda row: row['id']):
        row = {field: order[field] for field in ORDER_GUARD_FIELDS}
        for field in ('total_amount', 'discount_amount', 'shipping_fee'):
            row[field] = str(Decimal(str(row[field])).quantize(Decimal('.01')))
        row['items'] = []
        for item in sorted(order['items'], key=lambda item: item['id']):
            line = {field: item[field] for field in ITEM_GUARD_FIELDS}
            for field in ('unit_price', 'subtotal'):
                line[field] = str(Decimal(str(line[field])).quantize(Decimal('.01')))
            row['items'].append(line)
        normalized.append(row)
    return hashlib.sha256(json.dumps(normalized, sort_keys=True).encode()).hexdigest()


def guarded_rows(orders):
    return [{**{field: getattr(order, field) for field in ORDER_GUARD_FIELDS},
        'items': [{**{field: getattr(item, 'product_id' if field == 'product' else field)
            for field in ITEM_GUARD_FIELDS}} for item in order.items.all()]} for order in orders]


def plan_recast(source, mapping, orders=None):
    validate_source(source)
    menus = index_names(source['menus'], 'guide menu')
    index_names(list(Product.objects.values('id', 'name')), 'database product')
    materials = index_names(list(RawMaterial.objects.values('id', 'name', 'unit')), 'database material')
    for row in source['raw_materials']:
        existing = materials.get(row['name'].casefold())
        if existing and existing['unit'] != row['unit']:
            raise ValidationError(f'{row["name"]}: material unit differs; no conversion is allowed.')
    translations = {key.casefold(): value.casefold() for key, value in mapping['products'].items()}
    if len(translations) != len(mapping['products']) or any(value not in menus for value in translations.values()):
        raise ValidationError('Mapping is ambiguous or refers to an unknown menu.')
    orders = list(orders if orders is not None else Order.objects.prefetch_related('items').order_by('pk'))
    if not orders or any(not list(order.items.all()) for order in orders):
        raise ValidationError('Expected nonempty fictional orders with recorded items.')
    ids = [order.pk for order in orders]
    if any(order.payment_method == 'wallet' for order in orders):
        raise ValidationError('Wallet orders require a separate ledger reconciliation; no data changed.')
    if IngredientConsumption.objects.filter(order_item__order_id__in=ids).exists():
        raise ValidationError('Structured ingredient consumption requires a separate stock reconciliation; no data changed.')
    lines, totals = {}, {}
    for order in orders:
        total = Decimal('0')
        for item in order.items.all():
            target = menus.get(translations.get(item.product_name.casefold(), item.product_name.casefold()))
            if target is None:
                raise ValidationError(f'No mapping for {item.product_name}.')
            subtotal = Decimal(target['price']) * item.quantity
            total += subtotal
            lines[item.pk] = {'name': target['name'], 'price': Decimal(target['price']), 'subtotal': subtotal}
        total -= order.discount_amount
        if total < 0:
            raise ValidationError('Fixed discount exceeds a replacement order subtotal.')
        old_payment_amount = order.total_amount + order.shipping_fee
        for event in order.payment_events.all():
            if event.method == 'wallet' or event.amount != old_payment_amount:
                raise ValidationError('A payment event requires additional reconciliation; no data changed.')
        totals[order.pk] = total
    return {'fingerprint': history_fingerprint(guarded_rows(orders)),
        'orders': len(orders), 'items': len(lines), 'menus': len(source['menus']),
        'materials': len(source['raw_materials']),
        'old_food_total': str(sum((o.total_amount for o in orders), Decimal('0'))),
        'new_food_total': str(sum(totals.values(), Decimal('0'))),
        'payment_events': PaymentEvent.objects.filter(order_id__in=ids).count(),
        'legacy_consumption_flags_to_clear': sum(o.inventory_deducted for o in orders),
        'inventory_changes': 0}, lines, totals


@transaction.atomic
def apply_recast(source, mapping, expected_fingerprint):
    previous = OrderAmendment.objects.filter(after__kind=KIND, after__operation_id=expected_fingerprint).first()
    if previous:
        return {**previous.after['summary'], 'already_applied': True}
    # All catalogue and order edits are committed together or rolled back together.
    list(Category.objects.select_for_update())
    list(RawMaterial.objects.select_for_update())
    list(Product.objects.select_for_update())
    orders = list(Order.objects.select_for_update().prefetch_related('items', 'payment_events').order_by('pk'))
    list(OrderItem.objects.select_for_update().filter(order__in=orders))
    list(PaymentEvent.objects.select_for_update().filter(order__in=orders))
    summary, lines, totals = plan_recast(source, mapping, orders)
    if summary['fingerprint'] != expected_fingerprint:
        raise ValidationError('Demo history changed since the reviewed snapshot; no data changed.')

    catalogue_backup = json_safe({
        'categories': list(Category.objects.values()),
        'materials': list(RawMaterial.objects.values()),
        'products': list(Product.objects.values()),
        'product_ingredients': list(ProductIngredient.objects.values()),
    })
    before = {}
    for order in orders:
        before[order.pk] = json_safe({
            'order_id': order.pk, 'order': {field: getattr(order, field) for field in BACKUP_ORDER_FIELDS},
            'items': list(OrderItem.objects.filter(order=order).values()),
            'accepted_ingredients': list(OrderIngredient.objects.filter(order_item__order=order).values()),
            'payments': list(PaymentEvent.objects.filter(order=order).values()),
        })
    # Backups are stored in the same durable database and transaction as the rewrite.
    before[orders[0].pk]['catalogue_before'] = catalogue_backup
    categories = {row.name.casefold(): row for row in Category.objects.all()}
    for name in sorted({menu['category'] for menu in source['menus']}):
        categories.setdefault(name.casefold(), Category.objects.get_or_create(name=name)[0])
    materials = {row.name.casefold(): row for row in RawMaterial.objects.all()}
    for row in source['raw_materials']:
        existing = materials.get(row['name'].casefold())
        serializer = RawMaterialSerializer(existing, data=row, partial=existing is not None)
        serializer.is_valid(raise_exception=True)
        materials[row['name'].casefold()] = serializer.save()
    products = {row.name.casefold(): row for row in Product.objects.all()}
    category_ids = {key: {'id': row.pk} for key, row in categories.items()}
    material_ids = {key: {'id': row.pk} for key, row in materials.items()}
    for row in source['menus']:
        payload = menu_payload(row, category_ids, material_ids, 'active')
        # These are replacement demo menus, with no obsolete retail summary/weekday restrictions.
        payload.update(ai_summary='', delivery_weekdays=[])
        existing = products.get(row['name'].casefold())
        serializer = ProductSerializer(existing, data=payload, partial=existing is not None)
        serializer.is_valid(raise_exception=True)
        products[row['name'].casefold()] = serializer.save()
    targets = {row['name'].casefold() for row in source['menus']}
    archived = Product.objects.exclude(pk__in=[products[key].pk for key in targets]).update(selling_status='archived')

    for order in orders:
        for item in order.items.all():
            target = lines[item.pk]
            product = products[target['name'].casefold()]
            item.product = product
            item.product_name = product.name
            item.unit_price = target['price']
            item.subtotal = target['subtotal']
            item.packaging_unit_cost = product.packaging_cost
            item.preparation_snapshot = preparation_snapshot(product)
            item.recipe_source = 'demo_recast'
            item.save(update_fields=['product', 'product_name', 'unit_price', 'subtotal',
                'packaging_unit_cost', 'preparation_snapshot', 'recipe_source'])
            item.accepted_ingredients.all().delete()
            OrderIngredient.objects.bulk_create([OrderIngredient(order_item=item,
                raw_material=ingredient.raw_material, material_name=ingredient.raw_material.name,
                unit=ingredient.raw_material.unit, quantity_per_portion=ingredient.quantity_required)
                for ingredient in product.ingredients.select_related('raw_material')])
        order.total_amount = totals[order.pk]
        order.inventory_deducted = False
        order.preparation_at = order.preparation_end_at = None
        order.preparation_plan = {'needs_review': True, 'demo_recast': True,
            'tasks': [], 'note': 'Fictional history was recast with new recipes; preparation and stock consumption have not been performed.'}
        order.save(update_fields=list(BACKUP_ORDER_FIELDS) + ['updated_at'])
        for event in order.payment_events.all():
            event.amount = order.total_amount + order.shipping_fee
            event.source = 'demo_recast'
            event.note = (event.note + ' | Fictional demo catalogue/price replacement.').strip(' |')[:500]
            event.save(update_fields=['amount', 'source', 'note'])
        OrderAmendment.objects.create(order=order, before=before[order.pk], after={
            'kind': KIND, 'operation_id': expected_fingerprint, 'synthetic_demo': True,
            'summary': summary, 'total_amount': str(order.total_amount),
            'items': [{'id': item.pk, 'menu': lines[item.pk]['name'], 'unit_price': str(lines[item.pk]['price'])}
                for item in order.items.all()]})
    # Old retail labels no longer describe the replacement demo catalogue.
    obsolete_categories = Category.objects.exclude(pk__in=[categories[row['category'].casefold()].pk for row in source['menus']])
    removed_categories = obsolete_categories.count()
    obsolete_categories.delete()  # Archived product categories become NULL; backup retains original labels.
    return {**summary, 'archived_products': archived, 'removed_legacy_categories': removed_categories, 'already_applied': False}
