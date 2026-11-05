"""Read-only menu yield estimates from physical stock, shared per response.

Each menu is considered separately: shared ingredients and supplies cannot be
added across menu estimates. Checkout validates and allocates the whole basket.
"""
from collections import defaultdict
from django.db.models import Sum
from django.utils import timezone
from ..models import InventoryItem, ProductPackaging


class MenuStockSnapshot:
    def __init__(self, day=None):
        self.today = timezone.localdate()
        self.day = day or self.today
        self._ingredients = None
        self._packaging = None

    def available(self, product):
        recipe = list(product.ingredients.all())
        if not recipe or any(row.quantity_required <= 0 for row in recipe):
            return 0
        if self._ingredients is None:
            self._ingredients = dict(InventoryItem.objects.filter(
                quantity__gt=0, quarantined=False, received_date__lte=self.today,
                expiry_date__gte=self.day).values('raw_material_id')
                .annotate(total=Sum('quantity')).values_list('raw_material_id', 'total'))
        limits = [self._ingredients.get(row.raw_material_id, 0) // row.quantity_required for row in recipe]
        if self._packaging is None:
            self._packaging = defaultdict(list)
            for product_id, required, quantity, active in ProductPackaging.objects.values_list(
                    'product_id', 'quantity_per_item', 'packaging_item__quantity', 'packaging_item__is_active'):
                self._packaging[product_id].append(quantity // required if active and required > 0 else 0)
        limits.extend(self._packaging[product.pk])
        return max(0, int(min(limits)))
