"""Read-only replay of labelled weeks excluded from the saved model's training."""
from . import service


def backtest(values):
    history, model, metrics, _ = service.bundle()
    if set(values) != {'center_id', 'week'}:
        raise service.PredictiveError('invalid_parameters', 'Provide only center_id and week.', 400)
    parsed = {}
    for name in ('center_id', 'week'):
        value = values[name]
        if isinstance(value, bool) or not str(value).isascii() or not str(value).isdigit() or int(value) < 1:
            raise service.PredictiveError('invalid_parameters', 'center_id and week must be positive integers.', 400)
        parsed[name] = int(value)
    center, week = parsed['center_id'], parsed['week']
    start, end = metrics.get('validation_start_week'), metrics.get('validation_end_week')
    cutoff = metrics.get('train_max_week')
    if not all(type(v) is int for v in (start, end, cutoff)) or not cutoff < start <= end:
        raise service.PredictiveError('model_unavailable', 'Compatible chronological evaluation metadata is required.')
    if not start <= week <= end:
        raise service.PredictiveError('invalid_parameters', f'Choose a held-out week from {start} to {end}.', 400)
    if center not in set(history.center_id):
        raise service.PredictiveError('invalid_parameters', 'Unknown center_id.', 400)

    import numpy as np
    from .forecast_core import historical_features, FEATURES
    # Filter before feature construction: future target rows cannot enter replay.
    frame = historical_features(history[(history.center_id == center) & (history.week <= week)])
    rows = frame[frame.week == week].copy()
    if rows.empty:
        raise service.PredictiveError('no_eligible_history', 'No labelled observations for this center and week.', 422)
    predicted = np.maximum(0, np.expm1(model.predict(rows[FEATURES], thread_count=2)))
    if not np.isfinite(predicted).all():
        raise service.PredictiveError('model_unavailable', 'Model returned nonfinite predictions.')
    actual = rows.num_orders.to_numpy(dtype=float)
    baseline = rows.lag1.to_numpy(dtype=float)
    if not np.isfinite(actual).all() or not np.isfinite(baseline).all() or (actual < 0).any():
        raise service.PredictiveError('source_data_unavailable', 'Invalid labelled evaluation observations.')
    denominator = float(np.abs(actual).sum())

    def scores(prediction):
        error = np.abs(actual - prediction)
        return {'wape_percent': float(error.sum() / denominator * 100) if denominator else None,
                'mae_orders_per_meal': float(error.mean())}

    rows['predicted_orders'] = predicted
    rows['baseline_orders'] = baseline
    rows['actual_orders'] = actual
    rows['meal_id'] = rows.meal_id.astype(int)
    return dict(api_version='1', mode='historical_backtest', center_id=center, week=week,
                model_status='ready', sources={'demand': 'GENPACT_HISTORICAL', 'operational': 'NOT_USED'},
                training_max_week=cutoff, evaluation_protocol='rolling_one_week_ahead',
                observations=len(rows), actual_orders_total=float(actual.sum()),
                scores={'catboost': scores(predicted), 'previous_observation': scores(baseline)},
                meal_comparisons=rows[['meal_id', 'actual_orders', 'predicted_orders', 'baseline_orders']].to_dict('records'),
                warnings=[
                    'This week was excluded from model fitting; it is part of the already reported holdout, not a new independent test.',
                    'Lag features use earlier actual observations only. Gaps use the previous observed record, not necessarily the previous calendar week.',
                    'Historical prices and promotion flags are assumed known for the target week. Replay is not the carried-price future forecast scenario.',
                    'Scores cover only the selected center/week; compare the whole holdout using metrics/. Zero actual totals have null WAPE.',
                    'External Genpact observations are not this store\'s order history. This endpoint does not calculate inventory risk or change database records.'
                ])
