"""Local demand -> dated recipe needs -> conservative, reviewable stock decisions.

No Genpact identities, automatic promotions, purchases or inventory writes.
"""
from collections import Counter, defaultdict
from datetime import timedelta
from statistics import mean

from django.utils import timezone
from django.db.models import Q
from ..models import Order, Product
from .demo_provenance import synthetic_history


METHODS = ('mean_28', 'mean_7', 'same_weekday')


def daily_prediction(values, method):
    if not values:
        return 0.
    if method == 'same_weekday' and len(values) >= 7:
        return mean(values[-7::-7][:4])
    return mean(values[-(7 if method == 'mean_7' else 28):])


def score(values, start, end, method):
    actual = values[start:end]
    predicted = [daily_prediction(values[:i], method) for i in range(start, end)]
    errors = [abs(a-b) for a, b in zip(actual, predicted)]
    return {'mae': round(mean(errors), 4),
            'wape_percent': round(sum(errors)/sum(actual)*100, 2) if sum(actual) else None,
            'actual_portions': sum(actual), 'predicted_portions': round(sum(predicted), 2),
            'daily_actual': actual, 'daily_predictions': [round(v, 3) for v in predicted]}


def horizon_score(values, start, horizon, method):
    """Replay complete forecast windows without observing outcomes inside a window.

    Origins overlap; these are descriptive test scores, not independent trials.
    This diagnostic never participates in method selection.
    """
    errors, actuals, total_errors = [], [], []
    for origin in range(start, len(values)-horizon+1):
        history = list(values[:origin])
        predictions = []
        for _ in range(horizon):
            prediction = daily_prediction(history, method)
            predictions.append(prediction)
            history.append(prediction)
        actual = values[origin:origin+horizon]
        errors.extend(abs(a-p) for a, p in zip(actual, predictions))
        actuals.extend(actual)
        total_errors.append(abs(sum(actual)-sum(predictions)))
    return {'windows': len(total_errors), 'mae': round(mean(errors), 4) if errors else None,
        'wape_percent': round(sum(errors)/sum(actuals)*100, 2) if sum(actuals) else None,
        'window_total_mae': round(mean(total_errors), 4) if total_errors else None}


def menu_forecast(values, dates, horizon):
    """Select on validation only; keep the final test separate. Refit moving baselines."""
    method, evaluation = 'mean_28', None
    if len(values) >= 42:
        end_train = len(values)-28
        validation = {m: score(values, end_train, end_train+14, m) for m in METHODS}
        method = min(METHODS, key=lambda m: validation[m]['mae'])
        evaluation = {'train_days': end_train, 'validation_days': 14, 'test_days': 14,
            'validation_start': str(dates[end_train]), 'test_start': str(dates[-14]),
            'test_end': str(dates[-1]), 'validation': validation,
            'test': {m: score(values, len(values)-14, len(values), m) for m in METHODS},
            'planning_horizon_test': {'horizon_days': horizon,
                'strategy': 'Overlapping full-window forecasts within the held-out test period; predictions feed forward without observing outcomes inside each window. Not used for method selection.',
                'test': {m: horizon_score(values, len(values)-14, horizon, m) for m in METHODS}}}
    history, predictions = list(values), []
    for _ in range(horizon):
        value = daily_prediction(history, method)
        predictions.append(value)
        history.append(value)
    error = evaluation['test'][method]['mae'] if evaluation else None
    horizon_test = evaluation['planning_horizon_test']['test'][method] if evaluation else None
    reliable = bool(horizon_test and sum(v > 0 for v in values) >= 7 and
        horizon_test['wape_percent'] is not None and horizon_test['wape_percent'] <= 75)
    return {'method': method, 'history_days': len(values), 'selling_days': sum(v > 0 for v in values),
            'daily_predictions': predictions, 'forecast_portions': round(sum(predictions), 2) if values else None,
            'evaluation': evaluation, 'daily_error': error,
            'confidence': 'evaluated' if reliable else 'limited' if values else 'unavailable'}


def project_batches(plan, daily_need, *, trace=None):
    """Allocate only remaining stock, once, with receipt/expiry eligibility per day."""
    stock = {b['batch_id']: float(b['remaining_quantity']) for b in plan['batches'] if b['eligible']}
    shortage = Counter()
    allocations = []
    for (day, material), quantity in sorted(daily_need.items()):
        left = quantity
        for batch in sorted(plan['batches'], key=lambda b: (b['expiry_date'], b['batch_id'])):
            if (batch['batch_id'] not in stock or batch['raw_material_id'] != material or
                    not batch['received_date'] <= day <= batch['expiry_date']):
                continue
            take = min(left, stock[batch['batch_id']])
            stock[batch['batch_id']] -= take
            left -= take
            if trace is not None and take > 1e-9:
                allocations.append({'date': day, 'batch_id': batch['batch_id'], 'raw_material_id': material, 'quantity': take})
            if left <= 1e-9:
                break
        shortage[material] += max(0., left)
    waste, cost = Counter(), Counter()
    unknown = set()
    costs = {b['batch_id']: b.get('unit_cost') for b in plan['batches']}
    for b in plan['batches']:
        remaining = stock.get(b['batch_id'], 0.)
        if b['expiry_date'] <= plan['window']['end_date'] and remaining > 1e-9:
            material = b['raw_material_id']
            waste[material] += remaining
            if costs[b['batch_id']] is None:
                unknown.add(material)
            else:
                cost[material] += remaining*costs[b['batch_id']]
    if trace is not None:
        trace['allocations'] = allocations
        trace['batches'] = [dict(batch_id=b['batch_id'], batch_code=b.get('batch_code', ''),
            raw_material_id=b['raw_material_id'], unit=b['unit'], expiry_date=b['expiry_date'],
            opening_quantity=b['quantity'], confirmed_allocated=b['allocated_quantity'],
            after_confirmed=b['remaining_quantity'], forecast_consumed=b['remaining_quantity']-stock[b['batch_id']],
            projected_remaining=stock[b['batch_id']], expires_in_window=b['expiry_date']<=plan['window']['end_date'],
            unit_cost=b.get('unit_cost')) for b in plan['batches'] if b['batch_id'] in stock]
    return waste, shortage, {m: None if m in unknown else cost[m] for m in waste}


def demand_snapshot(*, today=None, horizon_days=28):
    today = today or timezone.localdate()
    start, end = today-timedelta(days=112), today+timedelta(days=horizon_days)
    # Match decision_support's delivery-date/fallback window before prefetching
    # items. Older and distant future orders cannot affect this daily forecast.
    window = Q(delivery_at__date__gte=start, delivery_at__date__lt=end) | Q(
        delivery_at__isnull=True, created_at__date__gte=start, created_at__date__lt=end)
    return (list(Product.objects.prefetch_related('ingredients__raw_material').order_by('id')),
            list(Order.objects.filter(window).prefetch_related('items').order_by('pk')), timezone.localtime())


def decision_support(plan, *, today=None, snapshot=None):
    today = today or timezone.localdate()
    horizon = plan['window']['horizon_days']
    start = today-timedelta(days=112)
    products, orders, earliest = snapshot or demand_snapshot(today=today,horizon_days=horizon)
    product_map = {p.pk: p for p in products}
    history = defaultdict(Counter)
    synthetic_by_menu = Counter()
    commitments = Counter()
    exclusions, estimated_by_menu, estimated = Counter(), Counter(), 0
    for order in orders:
        day = timezone.localtime(order.delivery_at or order.created_at).date()
        created = timezone.localtime(order.created_at).date()
        if not start <= day < today+timedelta(days=horizon):
            continue
        if created > day:
            exclusions['invalid_order_dates'] += 1
            continue
        if order.status == 'cancelled' or order.payment_status == 'refunded':
            continue
        for item in order.items.all():
            if item.quantity <= 0:
                exclusions['invalid_quantity'] += 1
                continue
            if not item.product_id or item.product_id not in product_map:
                exclusions['removed_menu'] += 1
                continue
            if today <= day < today+timedelta(days=horizon):
                # Includes unpaid requests: do not add their portions again as new demand.
                commitments[(item.product_id, str(day))] += item.quantity
            if not start <= day < today or order.status != 'delivered' or order.payment_status != 'paid':
                continue
            if item.product_name and item.product_name != product_map[item.product_id].name:
                exclusions['historical_menu_identity_changed'] += 1
                continue
            history[item.product_id][day] += item.quantity
            synthetic_by_menu[item.product_id] += int(synthetic_history(order))
            estimated += order.delivery_at is None
            estimated_by_menu[item.product_id] += order.delivery_at is None
    menus, recipes, recipe_materials = [], defaultdict(list), {}
    contributions = defaultdict(list)
    need = {level: Counter() for level in ('low', 'central', 'high')}
    for product in products:
        if product.selling_status != 'active':
            continue
        sales = history[product.pk]
        dates = []
        if sales:
            day = max(start, min(sales))
            while day < today:
                dates.append(day)
                day += timedelta(days=1)
        values = [sales[d] for d in dates]
        result = menu_forecast(values, dates, horizon)
        result['estimated_date_items'] = estimated_by_menu[product.pk]
        result['synthetic_history_items'] = synthetic_by_menu[product.pk]
        if result['confidence'] == 'evaluated' and estimated_by_menu[product.pk]:
            result['confidence'] = 'limited'
        recipe = list(product.ingredients.all())
        valid_recipe = bool(recipe) and all(i.quantity_required > 0 for i in recipe)
        known_cost = valid_recipe and product.packaging_cost is not None and all(i.raw_material.estimated_unit_cost is not None for i in recipe)
        result.update(product_id=product.pk, product_name=product.name,
            price_myr=float(product.price), variable_cost_myr=float(product.packaging_cost + sum(
                (i.quantity_required*i.raw_material.estimated_unit_cost for i in recipe), 0)) if known_cost else None,
            recipe_complete=valid_recipe, total_recorded_portions=sum(values),
            future_committed_portions=sum(commitments[(product.pk, str(today+timedelta(days=i)))] for i in range(horizon)),
            history=[{'date': str(d), 'portions': sales[d]} for d in dates])
        # Residual error is a sensitivity range, not a calibrated confidence interval.
        error = result['daily_error']
        error = error if error is not None else max(result['daily_predictions'], default=0.)
        result['sensitivity_error_portions_per_day'] = round(error, 4)
        additional_total = 0.
        adjustments = Counter()
        for offset, prediction in enumerate(result['daily_predictions']):
            day = today+timedelta(days=offset)
            allowed = (not product.delivery_weekdays or day.weekday() in product.delivery_weekdays)
            if not allowed:
                adjustments['delivery_day_excluded'] += prediction
                continue
            if day < (earliest+timedelta(hours=product.lead_hours)).date():
                adjustments['lead_time_excluded'] += prediction
                continue
            committed = commitments[(product.pk, str(day))]
            additional = max(0., min(product.daily_capacity, prediction)-committed)
            adjustments['capacity_excluded'] += max(0., prediction-product.daily_capacity)
            adjustments['recorded_orders_offset'] += min(product.daily_capacity, prediction, committed)
            additional_total += additional
            for level, total in [('low', max(0., prediction-error)), ('central', prediction), ('high', prediction+error)]:
                residual = max(0., min(product.daily_capacity, total)-committed)
                if valid_recipe:
                    for ingredient in recipe:
                        quantity = residual*float(ingredient.quantity_required)
                        need[level][(str(day), ingredient.raw_material_id)] += quantity
                        if level == 'central' and quantity > 1e-9:
                            contributions[(str(day), ingredient.raw_material_id)].append({
                                'product_id': product.pk, 'product_name': product.name,
                                'additional_portions': residual, 'quantity_per_portion': float(ingredient.quantity_required),
                                'requirement': quantity})
        result['additional_forecast_portions'] = round(additional_total, 2) if values else None
        result['demand_adjustments'] = {key: round(adjustments[key], 2) for key in (
            'delivery_day_excluded', 'lead_time_excluded', 'capacity_excluded', 'recorded_orders_offset')}
        # Round only API display values, never FEFO inputs.
        result['daily_predictions'] = [round(v, 3) for v in result['daily_predictions']]
        menus.append(result)
        if valid_recipe:
            for ingredient in recipe:
                recipe_materials[ingredient.raw_material_id] = ingredient.raw_material
                recipes[ingredient.raw_material_id].append({'product_id': product.pk, 'product_name': product.name,
                    'quantity_per_portion': float(ingredient.quantity_required), 'confidence': result['confidence']})
    trace = {}
    projections = {level: project_batches(plan, needs, trace=trace if level=='central' else None) for level, needs in need.items()}
    # A material with no existing batch can still have a future recipe need.
    # Extend only this enriched in-memory plan; the original local-plan API stays unchanged.
    existing = {r['raw_material_id'] for r in plan['ingredient_risks']}
    future_materials = {material for (_, material), q in need['central'].items() if q > 1e-9}
    for key in sorted(future_materials-existing):
        material = recipe_materials[key]
        plan['ingredient_risks'].append({'ingredient_id': f'raw-material-{key}', 'raw_material_id': key,
            'ingredient_name': material.name, 'unit': material.unit, 'risk_type': 'none',
            'confirmed_requirement': 0., 'eligible_stock': 0., 'allocated_quantity': 0., 'shortfall_quantity': 0.,
            'expiring_unused_quantity': 0., 'potential_waste_cost_myr': 0., 'estimated_purchase_cost_myr': 0.,
            'urgent_by': min(day for (day, m), q in need['central'].items() if m == key and q > 1e-9),
            'action': 'Review forecast need and recording coverage before buying speculative stock.',
            'explanation': 'No recorded stock or confirmed recipe allocation covers this ingredient. Forecast need is separate from a confirmed customer commitment.'})
    risks = []
    for original in plan['ingredient_risks']:
        risk = dict(original)
        key = risk['raw_material_id']
        central_waste, central_short, costs = projections['central']
        waste_low = projections['high'][0][key]
        waste_high = projections['low'][0][key]
        mapped = recipes[key]
        batch_flow = [b for b in trace['batches'] if b['raw_material_id']==key]
        total = lambda field: round(sum(b[field] for b in batch_flow), 3)
        flow = {'opening_quantity': total('opening_quantity'), 'confirmed_allocated': total('confirmed_allocated'),
            'after_confirmed': total('after_confirmed'), 'forecast_consumed': total('forecast_consumed'),
            'projected_total_remaining': total('projected_remaining'),
            'projected_expiring_unused': round(central_waste[key], 3),
            'projected_carried_stock': round(sum(b['projected_remaining'] for b in batch_flow if not b['expires_in_window']), 3),
            'batches': batch_flow,
            'allocations': [a for a in trace['allocations'] if a['raw_material_id']==key]}
        expiring = [b for b in batch_flow if b['expires_in_window']]
        flow['expiry_focus'] = {field: round(sum(b[field] for b in expiring), 3) for field in (
            'opening_quantity', 'confirmed_allocated', 'forecast_consumed', 'projected_remaining')}
        flow['expiry_focus']['cost_known'] = costs.get(key, 0.) is not None
        flow['demand_by_day'] = [{'date': day, 'forecast_requirement': quantity,
            'forecast_consumed': sum(a['quantity'] for a in flow['allocations'] if a['date']==day),
            'menus': contributions[(day, key)]}
            for (day, material), quantity in sorted(need['central'].items()) if material==key and quantity>1e-9]
        fictional_stock = any(b.get('batch_code', '').startswith('DEMO-FC-INV-') for b in batch_flow)
        confident = (bool(mapped) and all(m['confidence'] == 'evaluated' for m in mapped) and not fictional_stock and
            not any(synthetic_by_menu[m['product_id']] for m in mapped) and
            not plan['excluded_orders'] and not exclusions)
        status = ('confirmed_shortage' if risk['shortfall_quantity'] > 0 else
            'forecast_waste' if waste_low > 1e-6 and confident else
            'review' if risk['expiring_unused_quantity'] > 0 or central_short[key] > 0 else 'watch')
        review_reasons = []
        if not mapped:
            review_reasons.append('No active recipe maps to this ingredient.')
        elif any(m['confidence'] != 'evaluated' for m in mapped):
            review_reasons.append('Some mapped menus have limited or unavailable sales history.')
        if any(synthetic_by_menu[m['product_id']] for m in mapped):
            review_reasons.append('Mapped menu history includes generated demo records; evaluation does not establish real customer accuracy.')
        if fictional_stock:
            review_reasons.append('Stock includes fictional demo batches; quantities, dates and costs are scenario inputs.')
        if plan['excluded_orders']:
            review_reasons.append(f'{len(plan["excluded_orders"])} active order records are excluded from stock planning; review coverage.')
        if exclusions:
            review_reasons.append('Some history records fail identity or date checks.')
        if central_short[key] > 1e-6:
            review_reasons.append('Additional forecast demand exceeds stock usable on its required dates.')
        if not review_reasons:
            review_reasons.append('Review demand sensitivity and dated stock before acting on estimated surplus.')
        risk.update(stock_flow=flow, review_reasons=review_reasons, forecast_requirement=round(sum(q for (_, material), q in need['central'].items() if material == key), 3),
            forecast_shortfall=round(central_short[key], 3), forecast_expiring_unused=round(central_waste[key], 3),
            waste_sensitivity_low=round(waste_low, 3), waste_sensitivity_high=round(waste_high, 3),
            forecast_waste_cost_myr=round(costs.get(key, 0.), 2) if costs.get(key, 0.) is not None else None,
            confidence='evaluated' if confident else 'limited', signal=status, menus=mapped,
            alert_reason=('A dated confirmed order has uncovered ingredients.' if status == 'confirmed_shortage' else
                'Surplus persists even in the higher-demand sensitivity case.' if status == 'forecast_waste' else
                ' '.join(review_reasons) if status == 'review' else
                'No actionable gap found in the included evidence; keep monitoring.'))
        risks.append(risk)
    risks.sort(key=lambda r: ({'confirmed_shortage':0, 'forecast_waste':1, 'review':2, 'watch':3}[r['signal']], r['urgent_by'] or '9999'))
    return {'source': 'LOCAL_KITCHEN', 'target': 'Paid delivered portions per current menu per local delivery day',
        'synthetic_history_items': sum(synthetic_by_menu.values()),
        'forecast_status': 'evaluated_baselines' if any(m['confidence'] == 'evaluated' for m in menus) else
            'limited_baselines' if any(m['forecast_portions'] is not None for m in menus) else 'insufficient_history',
        'menus': menus, 'ingredient_risks': risks, 'estimated_date_items': estimated,
        'excluded_history': dict(exclusions), 'alert_count': sum(r['signal'] in ('confirmed_shortage','forecast_waste') for r in risks),
        'review_count': sum(r['signal'] == 'review' for r in risks),
        'assumptions': ['Current recipes map future portions only; historical renamed menus are excluded.',
            'Absent days mean zero recorded sales, not verified zero demand. Demo records remain demo evidence.',
            'Known booked portions are subtracted from total forecast before adding speculative ingredient needs.',
            'Forecast allocation uses delivery dates conservatively; the planner must verify earlier preparation, capacity and freshness.',
            'Lead times, delivery weekdays and daily portion limits constrain additional forecast use.',
            'Low/high cases vary daily demand by held-out MAE, or the forecast itself for sparse history; they are sensitivity cases, not confidence intervals.',
            'Forecast signals are suppressed when history, recipes or order coverage are incomplete. No sales uplift, savings or safety are guaranteed.'] +
            (['SYNTHETIC HISTORY INCLUDED: evaluation and projections exercise generated patterns; they do not establish real customer accuracy.'] if sum(synthetic_by_menu.values()) else [])}
