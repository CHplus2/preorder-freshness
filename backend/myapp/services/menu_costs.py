"""Current recipe estimates; never backfill an accepted order's actual costs."""
from decimal import Decimal


def current_menu_costs(product):
    recipe = list(product.ingredients.all())
    missing = [row.raw_material.name + ': ingredient unit cost' for row in recipe
               if row.raw_material.estimated_unit_cost is None]
    if not recipe:
        missing.append('Recipe not recorded')
    if any(row.quantity_required <= 0 for row in recipe):
        missing.append('Recipe quantities must be positive')
    ingredient = (sum((row.quantity_required * row.raw_material.estimated_unit_cost for row in recipe), Decimal('0'))
                  if recipe and all(row.raw_material.estimated_unit_cost is not None and row.quantity_required > 0 for row in recipe) else None)
    supplies = list(product.packaging_requirements.all())
    if supplies:
        missing.extend(row.packaging_item.name + ': packaging unit cost' for row in supplies
                       if row.packaging_item.unit_cost is None)
        packaging = (sum((row.quantity_per_item * row.packaging_item.unit_cost for row in supplies), Decimal('0'))
                     if all(row.packaging_item.unit_cost is not None for row in supplies) else None)
    else:
        packaging = product.packaging_cost
        if packaging is None:
            missing.append('Packaging cost not recorded')
    return ingredient, packaging, missing
