"""Delivery-based aggregate forecasts, without optional ML packages or Genpact files."""
from collections import Counter
from datetime import timedelta
from math import ceil

from django.utils import timezone
from ..models import Order


def dated_orders():
    """Project reporting dates; never turn an estimated date into a delivery promise."""
    for order in Order.objects.prefetch_related('items').order_by('created_at', 'pk'):
        yield order, timezone.localtime(order.delivery_at or order.created_at).date(), (
            'delivery_at' if order.delivery_at else 'preorder_date_fallback')


def monday(day):
    return day - timedelta(days=day.weekday())


def vector(values):
    return [1., values[-1], values[-2] if len(values) > 1 else 0.,
            sum(values[-4:]) / min(4, len(values))]


def fit(values):
    # Ridge regression on lagged portions. Fixed regularization, no test tuning.
    rows = [(vector(values[:i]), values[i]) for i in range(2, len(values))]
    matrix = [[sum(x[j]*x[k] for x, _ in rows) + (10. if j == k and j else 0.)
               for k in range(4)] + [sum(x[j]*y for x, y in rows)] for j in range(4)]
    for col in range(4):
        pivot = max(range(col, 4), key=lambda r: abs(matrix[r][col]))
        matrix[col], matrix[pivot] = matrix[pivot], matrix[col]
        divisor = matrix[col][col]
        if abs(divisor) < 1e-12:
            return [sum(values)/len(values), 0., 0., 0.]
        matrix[col] = [v/divisor for v in matrix[col]]
        for row in range(4):
            if row != col:
                factor = matrix[row][col]
                matrix[row] = [a-factor*b for a, b in zip(matrix[row], matrix[col])]
    return [row[-1] for row in matrix]


def predict(method, past, coefficients=None):
    if method == 'ridge_autoregression':
        return max(0., sum(a*b for a, b in zip(vector(past), coefficients)))
    if method == 'last_week':
        return float(past[-1])
    return sum(past[-4:])/min(4, len(past))


def evaluate(method, past, actual, coefficients=None):
    predictions = []
    history = list(past)
    for value in actual:
        predictions.append(predict(method, history, coefficients))
        history.append(value)  # Rolling one-week-ahead evaluation.
    error = sum(abs(a-b) for a, b in zip(actual, predictions))
    return {'mae_portions_per_week': round(error/len(actual), 3),
            'wape_percent': round(100*error/sum(actual), 3) if sum(actual) else None,
            'predictions': [round(p, 3) for p in predictions]}


def forecast_history(values, weeks):
    result = {'status': 'insufficient_history', 'selected_method': None,
              'candidate_model_trained': False, 'evaluation': None, 'model': None,
              'next_week_portions': None, 'history_weeks': len(values)}
    if not values or not sum(values):
        return result
    method = 'moving_average_4_weeks'
    if len(values) >= 14:
        size = max(2, ceil(len(values)*.2))
        train, valid, test = values[:-2*size], values[-2*size:-size], values[-size:]
        if len(train) >= 8:
            methods = ['moving_average_4_weeks', 'last_week', 'ridge_autoregression']
            coefficients = fit(train)
            validation = {m: evaluate(m, train, valid, coefficients) for m in methods}
            method = min(methods, key=lambda m: validation[m]['mae_portions_per_week'])
            test_coefficients = fit(train + valid)
            scores = {m: evaluate(m, train + valid, test, test_coefficients) for m in methods}
            result.update(candidate_model_trained=True, evaluation={
                'strategy': 'Chronological train/validation/test; rolling one-week forecasts. Method selected on validation only.',
                'train_weeks': len(train), 'validation_weeks': len(valid), 'test_weeks': len(test),
                'train_end': weeks[len(train)-1], 'validation_start': weeks[len(train)],
                'test_start': weeks[-size], 'test_end': weeks[-1],
                'validation': validation, 'test': scores, 'test_actual': test})
    coefficients = fit(values) if result['candidate_model_trained'] else None
    result.update(status='evaluated' if result['evaluation'] else 'baseline_only',
                  selected_method=method, next_week_portions=round(predict(method, values, coefficients), 1),
                  model={'kind': 'ridge_autoregression', 'features': ['intercept', 'lag1', 'lag2', 'rolling4'],
                         'coefficients': coefficients} if coefficients else None)
    return result


def kitchen_forecast(*, today=None):
    today = today or timezone.localdate()
    cutoff = monday(today)
    totals, orders_per_week, excluded = Counter(), Counter(), Counter()
    fallback = eligible = 0
    for order, day, basis in dated_orders():
        if order.status != 'delivered' or order.payment_status != 'paid':
            excluded['not_delivered_and_paid'] += 1
            continue
        if day >= cutoff or timezone.localtime(order.created_at).date() > day:
            excluded['incomplete_week_or_invalid_dates'] += 1
            continue
        portions = sum(i.quantity for i in order.items.all())
        if portions <= 0:
            excluded['empty_order'] += 1
            continue
        week = monday(day)
        totals[week] += portions
        orders_per_week[week] += 1
        eligible += 1
        fallback += basis == 'preorder_date_fallback'
    weeks = []
    if totals:
        day = min(totals)
        while day < cutoff:
            weeks.append(day)
            day += timedelta(days=7)
    values = [totals[w] for w in weeks]
    result = forecast_history(values, [str(w) for w in weeks])
    return {'api_version': '1', 'source': 'LOCAL_KITCHEN', 'as_of': str(today),
            'timezone': timezone.get_current_timezone_name(),
            'target': 'Paid delivered portions per completed Monday–Sunday delivery week',
            'date_basis': 'delivery_at; missing dates use preorder (created_at) date, explicitly estimated',
            'eligible_orders': eligible, 'estimated_date_orders': fallback,
            'excluded_orders': dict(excluded), 'forecast_week_start': str(cutoff),
            'history': [{'week_start': str(w), 'portions': totals[w], 'orders': orders_per_week[w]} for w in weeks],
            **result,
            'warnings': ['Absent weeks mean zero recorded sales; recording coverage and menu availability are unverified.',
                         'Database records may be fictional demo data; accuracy is not evidence of real customer demand.',
                         'Estimated dates are reporting fallbacks, not reconstructed delivery commitments.',
                         'Forecast covers the full current delivery week from completed weeks; confirmed bookings remain separate and must not be added twice.',
                         'The test set is untouched during method selection. Production coefficients are refitted on all completed history.']}
