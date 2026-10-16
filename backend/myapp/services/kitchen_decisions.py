"""Local demand -> dated recipe needs -> conservative, reviewable stock decisions.

No Genpact identities, automatic promotions, purchases or inventory writes.
"""
from collections import Counter, defaultdict
from datetime import timedelta
from statistics import mean

from django.utils import timezone
from ..models import Order, Product


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
            'test': {m: score(values, len(values)-14, len(values), m) for m in METHODS}}
    history, predictions = list(values), []
    for _ in range(horizon):
        value = daily_prediction(history, method)
        predictions.append(value)
        history.append(value)
    error = evaluation['test'][method]['mae'] if evaluation else None
    reliable = bool(evaluation and sum(v > 0 for v in values) >= 7 and
        evaluation['test'][method]['wape_percent'] is not None and
        evaluation['test'][method]['wape_percent'] <= 75)
    return {'method': method, 'history_days': len(values), 'selling_days': sum(v > 0 for v in values),
            'daily_predictions': predictions, 'forecast_portions': round(sum(predictions), 2) if values else None,
            'evaluation': evaluation, 'daily_error': error,
            'confidence': 'evaluated' if reliable else 'limited' if values else 'unavailable'}


def project_batches(plan, daily_need):
    """Allocate only remaining stock, once, with receipt/expiry eligibility per day."""
    stock = {b['batch_id']: float(b['remaining_quantity']) for b in plan['batches'] if b['eligible']}
    shortage = Counter()
    for (day, material), quantity in sorted(daily_need.items()):
        left = quantity
        for batch in sorted(plan['batches'], key=lambda b: (b['expiry_date'], b['batch_id'])):
            if (batch['batch_id'] not in stock or batch['raw_material_id'] != material or
                    not batch['received_date'] <= day <= batch['expiry_date']):
                continue
            take = min(left, stock[batch['batch_id']])
            stock[batch['batch_id']] -= take
            left -= take
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
    return waste, shortage, {m: None if m in unknown else cost[m] for m in waste}


def demand_snapshot():
    return (list(Product.objects.prefetch_related('ingredients__raw_material').order_by('id')),
            list(Order.objects.prefetch_related('items').order_by('pk')), timezone.localtime())


def decision_support(plan, *, today=None, snapshot=None):
    today = today or timezone.localdate()
    horizon = plan['window']['horizon_days']
    start = today-timedelta(days=112)
    products, orders, earliest = snapshot or demand_snapshot()
    product_map = {p.pk: p for p in products}
    history = defaultdict(Counter)
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
            estimated += order.delivery_at is None
            estimated_by_menu[item.product_id] += order.delivery_at is None
    menus, recipes, recipe_materials = [], defaultdict(list), {}
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
        additional_total = 0.
        for offset, prediction in enumerate(result['daily_predictions']):
            day = today+timedelta(days=offset)
            allowed = (not product.delivery_weekdays or day.weekday() in product.delivery_weekdays)
            if not allowed or day < (earliest+timedelta(hours=product.lead_hours)).date():
                continue
            committed = commitments[(product.pk, str(day))]
            additional = max(0., min(product.daily_capacity, prediction)-committed)
            additional_total += additional
            for level, total in [('low', max(0., prediction-error)), ('central', prediction), ('high', prediction+error)]:
                residual = max(0., min(product.daily_capacity, total)-committed)
                if valid_recipe:
                    for ingredient in recipe:
                        need[level][(str(day), ingredient.raw_material_id)] += residual*float(ingredient.quantity_required)
        result['additional_forecast_portions'] = round(additional_total, 2) if values else None
        # Round only API display values, never FEFO inputs.
        result['daily_predictions'] = [round(v, 3) for v in result['daily_predictions']]
        menus.append(result)
        if valid_recipe:
            for ingredient in recipe:
                recipe_materials[ingredient.raw_material_id] = ingredient.raw_material
                recipes[ingredient.raw_material_id].append({'product_id': product.pk, 'product_name': product.name,
                    'quantity_per_portion': float(ingredient.quantity_required), 'confidence': result['confidence']})
    projections = {level: project_batches(plan, needs) for level, needs in need.items()}
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
        confident = bool(mapped) and all(m['confidence'] == 'evaluated' for m in mapped) and not plan['excluded_orders'] and not exclusions
        status = ('confirmed_shortage' if risk['shortfall_quantity'] > 0 else
            'forecast_waste' if waste_low > 1e-6 and confident else
            'review' if risk['expiring_unused_quantity'] > 0 or central_short[key] > 0 else 'watch')
        risk.update(forecast_requirement=round(sum(q for (_, material), q in need['central'].items() if material == key), 3),
            forecast_shortfall=round(central_short[key], 3), forecast_expiring_unused=round(central_waste[key], 3),
            waste_sensitivity_low=round(waste_low, 3), waste_sensitivity_high=round(waste_high, 3),
            forecast_waste_cost_myr=round(costs.get(key, 0.), 2) if costs.get(key, 0.) is not None else None,
            confidence='evaluated' if confident else 'limited', signal=status, menus=mapped,
            alert_reason=('A dated confirmed order has uncovered ingredients.' if status == 'confirmed_shortage' else
                'Surplus persists even in the higher-demand sensitivity case.' if status == 'forecast_waste' else
                'Review before acting: limited history, unmapped recipes, uncertain demand or excluded commitments.' if status == 'review' else
                'No actionable gap found in the included evidence; keep monitoring.'))
        risks.append(risk)
    risks.sort(key=lambda r: ({'confirmed_shortage':0, 'forecast_waste':1, 'review':2, 'watch':3}[r['signal']], r['urgent_by'] or '9999'))
    return {'source': 'LOCAL_KITCHEN', 'target': 'Paid delivered portions per current menu per local delivery day',
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
            'Forecast signals are suppressed when history, recipes or order coverage are incomplete. No sales uplift, savings or safety are guaranteed.']}
