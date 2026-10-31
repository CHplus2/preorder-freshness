"""Actual owner-confirmed progress, shared by individual and grouped updates.

The caller holds an atomic order lock. These updates never infer progress from
the clock, take payment, book a courier or send mail inside the transaction.
"""
from rest_framework.exceptions import ValidationError


def validate_progress(order, target):
    transitions = {
        'pending': {'pending', 'processing', 'cooked', 'cancelled'},
        'processing': {'processing', 'cooked', 'cancelled'},
        'cooked': {'cooked', 'shipped', 'delivered', 'cancelled'},
        'shipped': {'shipped', 'delivered'},
        'delivered': {'delivered'}, 'cancelled': {'cancelled'},
    }
    if order.delivery_method == 'pickup' and target == 'shipped':
        raise ValidationError('Self-collection orders are marked collected after handover; they do not go out for delivery.')
    if target not in transitions.get(order.status, set()):
        raise ValidationError('Confirm preparation before delivery. Preparing and out-for-delivery updates are optional; cancellation is allowed before dispatch.')
    if target == 'processing' or (target == 'cooked' and order.status in ('pending', 'processing')):
        if (order.preparation_plan.get('needs_review') or not order.preparation_at or not order.preparation_end_at
                or order.preparation_end_at <= order.preparation_at or not order.delivery_at
                or order.preparation_end_at > order.delivery_at):
            raise ValidationError('Set and confirm preparation times in Planner before starting or finishing this order.')


def apply_progress(order, target, actor):
    validate_progress(order, target)
    from .packaging import allocate_packaging, release_packaging
    if target in ('processing', 'cooked'):
        allocate_packaging(order, actor)
    elif target == 'cancelled':
        release_packaging(order, actor)
    if target == 'cooked' and not order.inventory_deducted:
        from ..views.orders import deduct_order_inventory
        deduct_order_inventory(order, actor)
        order.inventory_deducted = True
    if target == 'shipped' and order.status != 'shipped':
        from .reminders import queue_dispatch_notice
        queue_dispatch_notice(order)
    order.status = target
    order.save()
