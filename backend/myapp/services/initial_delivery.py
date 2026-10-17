"""Validate a first delivery request without reserving or inventing preparation."""
from .commitments import scheduled_item
from .scheduling import schedule_order


def initial_delivery_plan(items, delivery_at, store, order_id, now):
    # Current settings are used only for request validation when accepted settings are absent.
    planning_items = [scheduled_item(item) if item.preparation_snapshot else item for item in items]
    plan = schedule_order(planning_items, delivery_at, store, now=now,
                          exclude_order_id=order_id, allow_manual_review=True)
    notes = 'First delivery date recorded by the owner. Review accepted recipes and confirm a preparation plan before starting work.'
    if plan.get('needs_review'):
        notes += ' ' + plan['review_reason']
    return dict(start=None, end=None, tasks=[], needs_review=True, review_reason=notes,
                delivery_buffer_minutes=store.delivery_buffer_minutes)
