import uuid
from django.db import migrations


def baseline(apps, schema_editor):
    Item = apps.get_model('myapp', 'OrderItem')
    Ingredient = apps.get_model('myapp', 'OrderIngredient')
    Recipe = apps.get_model('myapp', 'ProductIngredient')
    Order = apps.get_model('myapp', 'Order')
    Payment = apps.get_model('myapp', 'PaymentEvent')
    fields = ('lead_hours', 'preparation_minutes', 'preparation_tasks', 'max_preparation_days',
        'batch_size', 'additional_batch_minutes', 'packing_minutes_per_portion', 'max_early_minutes', 'daily_capacity')
    for item in Item.objects.select_related('product', 'order').iterator():
        item.recipe_source = 'legacy_unknown'
        if item.product and not item.order.inventory_deducted and item.order.status in ('pending', 'processing'):
            item.recipe_source = 'legacy_baseline'
            item.preparation_snapshot = {key: getattr(item.product, key) for key in fields}
            # A present-day baseline is NOT the historical recipe or actual cost.
            # Leave old packaging costs unknown until an explicit owner amendment.
            for r in Recipe.objects.filter(product_id=item.product_id).select_related('raw_material'):
                Ingredient.objects.create(order_item=item, raw_material_id=r.raw_material_id,
                    material_name=r.raw_material.name, unit=r.raw_material.unit,
                    quantity_per_portion=r.quantity_required)
        item.save(update_fields=['recipe_source', 'preparation_snapshot'])
    for order in Order.objects.filter(payment_status__in=['paid', 'refunded']).iterator():
        kinds = ['receipt', 'refund'] if order.payment_status == 'refunded' else ['receipt']
        for kind in kinds:
            Payment.objects.create(order=order, request_id=uuid.uuid4(), kind=kind, outcome='completed',
                amount=order.total_amount+order.shipping_fee, method=order.payment_method or 'legacy',
                reference='Imported prior order status', source='legacy_unverified',
                note='Opening balance inferred from the earlier status. Not independently verified bank evidence; original payment date unknown.')


class Migration(migrations.Migration):
    dependencies = [('myapp', '0015_commitments_and_outcomes')]
    operations = [migrations.RunPython(baseline, migrations.RunPython.noop)]
