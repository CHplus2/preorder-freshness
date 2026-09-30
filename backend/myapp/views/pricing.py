"""Owner-only what-if estimates; never changes a menu or promotion."""
from decimal import Decimal, ROUND_CEILING
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Product, Storefront


class PricingInput(serializers.Serializer):
    product = serializers.IntegerField(min_value=1)
    portions = serializers.IntegerField(min_value=1, max_value=10000)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    discount_percent = serializers.DecimalField(max_digits=4, decimal_places=1, min_value=0, max_value=50)
    ingredient_increase_percent = serializers.DecimalField(max_digits=5, decimal_places=1, min_value=0, max_value=500)
    additional_cost_per_portion = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)


def money(value):
    return str(value.quantize(Decimal('0.01'))) if value is not None else None


@api_view(['POST'])
@permission_classes([IsAdminUser])
def pricing_preview(request):
    form = PricingInput(data=request.data)
    form.is_valid(raise_exception=True)
    data = form.validated_data
    product = get_object_or_404(Product.objects.prefetch_related('ingredients__raw_material'), pk=data['product'])
    store = Storefront.objects.filter(pk=1).first() or Storefront()
    recipe = list(product.ingredients.all())
    missing = [i.raw_material.name + ': ingredient unit cost' for i in recipe if i.raw_material.estimated_unit_cost is None]
    if not recipe:
        missing.append('Recipe not recorded')
    if any(i.quantity_required <= 0 for i in recipe):
        missing.append('Recipe quantities must be positive')
    if product.packaging_cost is None:
        missing.append('Packaging cost not recorded')
    ingredient = sum((i.quantity_required * i.raw_material.estimated_unit_cost for i in recipe
                      if i.raw_material.estimated_unit_cost is not None), Decimal('0'))
    portions = data['portions']
    current_discount = Decimal(store.bulk_discount_percent) if portions >= store.bulk_minimum else Decimal('0')

    def scenario(price, discount, increase):
        gross = price * portions
        reduction = (gross * discount / 100).quantize(Decimal('0.01'))
        revenue = gross - reduction
        ingredients = ingredient * (1 + increase / 100) * portions if recipe and not any(
            i.raw_material.estimated_unit_cost is None for i in recipe) else None
        packaging = product.packaging_cost * portions if product.packaging_cost is not None else None
        additional = data['additional_cost_per_portion'] * portions
        total_cost = ingredients + packaging + additional if not missing else None
        value = revenue - total_cost if total_cost is not None else None
        return {'price': money(price), 'discount_percent': str(discount),
            'food_revenue': money(revenue), 'discount_amount': money(reduction),
            'ingredient_cost': money(ingredients), 'packaging_cost': money(packaging),
            'additional_cost': money(additional), 'total_cost': money(total_cost),
            'contribution': money(value), 'per_portion': money(value / portions) if value is not None else None,
            'margin_percent': str((value / revenue * 100).quantize(Decimal('0.1'))) if value is not None and revenue > 0 else None,
            'below_cost': value < 0 if value is not None else None,
            'break_even_price': str((total_cost / portions / (1 - discount / 100)).quantize(
                Decimal('0.01'), rounding=ROUND_CEILING)) if total_cost is not None else None}

    baseline = scenario(product.price, current_discount, Decimal('0'))
    proposed = scenario(data['price'], data['discount_percent'], data['ingredient_increase_percent'])
    return Response({'menu': product.name, 'portions': portions, 'missing': missing,
        'baseline': baseline, 'proposed': proposed,
        'contribution_change': money(Decimal(proposed['contribution'])-Decimal(baseline['contribution'])) if not missing else None,
        'current_bulk_minimum': store.bulk_minimum,
        'assumptions': {'price': money(data['price']), 'discount_percent': str(data['discount_percent']),
            'ingredient_increase_percent': str(data['ingredient_increase_percent']),
            'additional_cost_per_portion': money(data['additional_cost_per_portion'])},
        'definition': 'One menu and the selected portions only. Baseline uses current price and the current bulk promotion when eligible. Scenario discount applies to the entire simulated order regardless of the current threshold. Ingredient increase applies only to scenario ingredients; the additional per-portion cost applies to both comparisons. No waste allowance, delivery, fees, labour or overhead is included unless you enter it as additional cost. Estimates, not net profit or a capacity promise. Prices and promotions are not saved.'})
