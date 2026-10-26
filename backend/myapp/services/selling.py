"""Separate local preorders from offers needing a courier agreement."""
from rest_framework.exceptions import ValidationError


def shipping_enquiry(product):
    details = getattr(product, 'selling_details', {}) or {}
    return isinstance(details, dict) and details.get('ordering_mode') == 'shipping_enquiry'


def require_local_preorder(product):
    details = getattr(product, 'selling_details', {})
    if not isinstance(details, dict) or details.get('ordering_mode', 'local_preorder') not in ('local_preorder', 'shipping_enquiry'):
        raise ValidationError(f'{product.name} has invalid ordering settings. Ask the kitchen to review this offer.')
    if shipping_enquiry(product):
        raise ValidationError(f'{product.name} requires a shipping enquiry. Agree the courier, shipping fee and arrival estimate with the kitchen before ordering. Its dispatch window is not a delivery booking.')
