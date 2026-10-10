"""Read-only ingredient decisions from known bookings and database batch dates.

This service does not forecast unbooked demand or load a trained model.
Accepted order recipes, rather than today's mutable menu recipes, set needs.
"""
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from ..models import InventoryItem, Order, RawMaterial


UNITS = {'g': ('mass', Decimal('1')), 'kg': ('mass', Decimal('1000')),
         'ml': ('volume', Decimal('1')), 'l': ('volume', Decimal('1000')),
         'unit': ('count', Decimal('1'))}


def convert(quantity, source, destination):
    if source not in UNITS or destination not in UNITS or UNITS[source][0] != UNITS[destination][0]:
        raise ValueError('Incompatible recipe and material units.')
    return quantity * UNITS[source][1] / UNITS[destination][1]


def local_plan(horizon_days=7):
    today = timezone.localdate()
    end = today + timedelta(days=horizon_days - 1)
    materials = {m.pk: m for m in RawMaterial.objects.all()}
    orders = list(Order.objects.filter(status__in=['pending', 'processing'])
                  .prefetch_related('items__accepted_ingredients').order_by('preparation_at', 'id'))
    batches = list(InventoryItem.objects.filter(quantity__gt=0).order_by('expiry_date', 'id'))
    exclusions, included = [], []
    demands = defaultdict(Decimal)
    needs_by_order = []
    for order in orders:
        reason = None
        if order.inventory_deducted:
            reason = 'inventory_already_deducted'
        elif order.payment_status != 'paid':
            reason = 'not_paid'
        elif not order.preparation_plan or order.preparation_plan.get('needs_review'):
            reason = 'preparation_needs_review'
        elif not order.preparation_at or not order.preparation_end_at or not order.delivery_at:
            reason = 'missing_schedule'
        elif order.preparation_end_at <= order.preparation_at or order.preparation_end_at > order.delivery_at:
            reason = 'invalid_schedule'
        if reason:
            exclusions.append({'order_id': order.pk, 'reason': reason})
            continue
        day = timezone.localtime(order.preparation_at).date()
        use_by = timezone.localtime(order.preparation_end_at).date()
        if day < today or day > end:
            exclusions.append({'order_id': order.pk,
                               'reason': 'overdue_preparation' if day < today else 'outside_horizon'})
            continue
        needs = defaultdict(Decimal)
        items = list(order.items.all())
        if not items:
            reason = 'missing_items'
        for item in items:
            ingredients = list(item.accepted_ingredients.all())
            if not ingredients:
                reason = 'missing_accepted_recipe'
                break
            for ingredient in ingredients:
                material = materials[ingredient.raw_material_id]
                try:
                    if ingredient.quantity_per_portion <= 0 or item.quantity <= 0:
                        raise ValueError('Nonpositive recipe or portions.')
                    needs[material.pk] += convert(ingredient.quantity_per_portion * item.quantity,
                                                   ingredient.unit, material.unit)
                except ValueError:
                    reason = 'invalid_recipe_quantity_or_unit'
                    break
            if reason:
                break
        if reason:
            # Exclude the whole order rather than hide an incomplete ingredient need.
            exclusions.append({'order_id': order.pk, 'reason': reason})
            continue
        included.append({'order_id': order.pk, 'preparation_date': str(day), 'use_by_date': str(use_by),
                         'portions': sum(i.quantity for i in items)})
        needs_by_order.append((order.pk, day, use_by, needs))
        for key, need in needs.items():
            demands[key] += need

    by_material = defaultdict(list)
    batch_rows = []
    available = defaultdict(Decimal)
    remaining = {}
    for batch in batches:
        reasons = []
        if batch.quarantined:
            reasons.append('quarantined')
        if batch.expiry_date < today:
            reasons.append('expired')
        if batch.received_date > today:
            reasons.append('not_received')
        if batch.expiry_date < batch.received_date:
            reasons.append('invalid_dates')
        eligible = not reasons
        row = {'batch_id': batch.pk, 'raw_material_id': batch.raw_material_id,
               'unit': materials[batch.raw_material_id].unit, 'quantity': float(batch.quantity),
               'received_date': str(batch.received_date), 'expiry_date': str(batch.expiry_date),
               'eligible': eligible, 'exclusion_reasons': reasons,
               'allocated_quantity': 0.0, 'remaining_quantity': float(batch.quantity)}
        batch_rows.append(row)
        if eligible:
            by_material[batch.raw_material_id].append((batch, row))
            available[batch.raw_material_id] += batch.quantity
            remaining[batch.pk] = batch.quantity

    allocations, shortages = [], []
    shortage_dates = defaultdict(list)
    allocated = defaultdict(Decimal)
    for order_id, day, use_by, needs in needs_by_order:
        for key, required in needs.items():
            left = required
            for batch, row in by_material[key]:
                if left <= 0:
                    break
                if batch.expiry_date < use_by:
                    continue
                quantity = min(left, remaining[batch.pk])
                if quantity <= 0:
                    continue
                remaining[batch.pk] -= quantity
                left -= quantity
                allocated[key] += quantity
                allocations.append({'order_id': order_id, 'batch_id': batch.pk, 'raw_material_id': key,
                                    'quantity': float(quantity), 'unit': materials[key].unit,
                                    'needed_by': str(day), 'use_by_date': str(use_by)})
                row['allocated_quantity'] = float(batch.quantity - remaining[batch.pk])
                row['remaining_quantity'] = float(remaining[batch.pk])
            if left > 0:
                shortages.append({'order_id': order_id, 'raw_material_id': key, 'quantity': float(left),
                                  'unit': materials[key].unit, 'needed_by': str(day)})
                shortage_dates[key].append(day)

    risks = []
    keys = set(demands) | {b.raw_material_id for b in batches}
    for key in sorted(keys):
        material = materials[key]
        expiring = [(b, remaining[b.pk]) for b, _ in by_material[key]
                    if b.expiry_date <= end and remaining[b.pk] > 0]
        expiry_quantity = sum((q for _, q in expiring), Decimal('0'))
        cost_known = all(b.unit_cost is not None for b, _ in expiring)
        waste_cost = sum((q * b.unit_cost for b, q in expiring), Decimal('0')) if cost_known else None
        shortfall = demands[key] - allocated[key]
        risk_type = ('expiry_surplus_and_shortage' if expiry_quantity and shortfall else
                     'expiry_surplus' if expiry_quantity else 'shortage' if shortfall else 'none')
        dates = [b.expiry_date for b, _ in expiring]
        dates += shortage_dates[key]
        urgent_by = min(dates) if dates else None
        explanation = (f'{demands[key]} {material.unit} required by included paid orders; '
                       f'{allocated[key]} {material.unit} assigned from eligible batches; '
                       f'{shortfall} {material.unit} still uncovered. '
                       f'{expiry_quantity} {material.unit} remains unallocated in batches dated to expire by {end}.')
        action = ('Review replenishment for uncovered orders and separately review expiring leftovers.'
                  if shortfall and expiry_quantity else 'Review purchasing to cover the dated order shortfall.'
                  if shortfall else 'Review safe uses or avoid additional purchases of expiring leftovers.'
                  if expiry_quantity else 'No shortage or expiry surplus found for included orders in this window.')
        risks.append({'ingredient_id': f'raw-material-{key}', 'raw_material_id': key,
                      'ingredient_name': material.name, 'unit': material.unit, 'risk_type': risk_type,
                      'confirmed_requirement': float(demands[key]), 'eligible_stock': float(available[key]),
                      'allocated_quantity': float(allocated[key]), 'shortfall_quantity': float(shortfall),
                      'expiring_unused_quantity': float(expiry_quantity),
                      'potential_waste_cost_myr': float(waste_cost) if waste_cost is not None else None,
                      'estimated_purchase_cost_myr': float(shortfall * material.estimated_unit_cost)
                          if material.estimated_unit_cost is not None else None,
                      'urgent_by': str(urgent_by) if urgent_by else None,
                      'action': action, 'explanation': explanation})
    # Never compare grams against litres to rank severity. Urgency comes first,
    # then known estimated waste exposure; unknown cost is disclosed, not zero.
    risks.sort(key=lambda r: (r['risk_type'] == 'none', r['urgent_by'] or '9999-12-31',
                              r['potential_waste_cost_myr'] is None,
                              -(r['potential_waste_cost_myr'] or 0), r['raw_material_id']))
    recommendations = [{'priority': i + 1, 'ingredient_id': r['ingredient_id'],
                        'raw_material_id': r['raw_material_id'], 'risk_type': r['risk_type'],
                        'urgent_by': r['urgent_by'], 'action': r['action'], 'explanation': r['explanation']}
                       for i, r in enumerate(r for r in risks if r['risk_type'] != 'none')]
    warnings = [
        'Known paid preorder requirements only: no prediction of additional customers or future bookings.',
        'Database records may be demo/test entries; database provenance does not prove real customer activity.',
        'FEFO allocation is advisory and nonpersistent; no stock is deducted or purchase placed.',
        'Unused stock is relative to included orders only; excluded or later orders may need it.',
        'Expiry dates are planning constraints, not a measurement or guarantee of food safety.',
        'Batch costs and raw-material purchase estimates are recorded estimates, not verified savings or supplier quotes.',
        'No safety-stock policy or supplier lead times are assumed.']
    if exclusions:
        warnings.append('Some active orders are excluded; review excluded_orders before making purchasing decisions.')
    if any(r['potential_waste_cost_myr'] is None for r in risks):
        warnings.append('Some expiring batch costs are missing; unknown waste exposure is null, not zero.')
    return {'api_version': '1', 'mode': 'local_plan', 'model_status': 'not_used',
            'as_of': str(today), 'timezone': timezone.get_current_timezone_name(),
            'window': {'start_date': str(today), 'end_date': str(end), 'horizon_days': horizon_days},
            'sources': {'demand': 'CONFIRMED_PAID_PREORDERS', 'operational': 'DATABASE',
                        'product_mapping': 'ACCEPTED_ORDER_RECIPES'},
            'coverage': {'active_orders': len(orders), 'included_orders': len(included),
                         'excluded_orders': len(exclusions), 'positive_batches': len(batches),
                         'eligible_batches': sum(b['eligible'] for b in batch_rows)},
            'included_orders': included, 'excluded_orders': exclusions, 'ingredient_risks': risks,
            'batch_allocations': allocations, 'batches': batch_rows, 'shortages': shortages,
            'recommendations': recommendations, 'warnings': warnings}
