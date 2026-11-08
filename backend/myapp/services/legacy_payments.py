"""Read-only protections for earlier payment records; no external payment calls."""
from rest_framework import serializers
from .arrival_windows import duration


def guard_legacy_payment_delivery(order, target, window_minutes=None):
    """Do not change an earlier escrow invoice's agreed deadline or window."""
    changed_window = window_minutes is not None and window_minutes != duration(order)
    if (order.payment_method == 'escrow'
            and order.payment_instructions.get('escrow_sepolia')
            and (target != order.delivery_at or changed_window)):
        raise serializers.ValidationError(
            'This earlier escrow invoice has a fixed delivery deadline. '
            'Escrow actions are no longer supported; retain this record and '
            'contact the kitchen to resolve the earlier arrangement.')
