"""Accepted menu terms shared by scheduling, shopping and cooking."""
from types import SimpleNamespace

PREPARATION_FIELDS = ('lead_hours', 'preparation_minutes', 'preparation_tasks',
    'max_preparation_days', 'batch_size', 'additional_batch_minutes',
    'packing_minutes_per_portion', 'max_early_minutes', 'daily_capacity', 'delivery_weekdays')


def preparation_snapshot(product):
    return {key: getattr(product, key) for key in PREPARATION_FIELDS}


def scheduled_item(item):
    if not item.preparation_snapshot:
        from rest_framework.exceptions import ValidationError
        raise ValidationError('This earlier order has no accepted preparation record. Contact the owner to resolve it.')
    product = SimpleNamespace(id=item.product_id, name=item.product_name, **item.preparation_snapshot)
    # Current daily limits still constrain a replanned booking.
    if item.product:
        product.daily_capacity = item.product.daily_capacity
    return SimpleNamespace(product=product, product_id=item.product_id, quantity=item.quantity)
