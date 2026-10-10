"""Offline CatBoost experiment on recorded booking volume, not kitchen usage.

No database writes, Genpact retraining, menu identity mapping or API promotion.
Missing calendar weeks mean zero records only with an explicit CLI assumption.
"""
import argparse
from datetime import timedelta
import hashlib
import json
import math
from pathlib import Path
import sys
from importlib.metadata import version

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor

from .local_preorders import normalize_snapshot, timestamp, week_start

FEATURES = ['lag1', 'lag2', 'rolling4', 'history_weeks', 'week_sin', 'week_cos']
PARAMETERS = dict(iterations=100, depth=3, learning_rate=0.05, loss_function='RMSE',
                  random_seed=42, thread_count=2, verbose=False, allow_writing_files=False)


def booking_history(snapshot, *, assume_recorded_zero_weeks=False):
    if not assume_recorded_zero_weeks:
        raise ValueError('Explicitly acknowledge missing weeks as zero recorded bookings, not zero true demand.')
    data = normalize_snapshot(snapshot)
    cutoff = week_start(timestamp(data['as_of']))
    bookings = {}
    included_orders = excluded_orders = 0
    for order in data['orders']:
        week = week_start(timestamp(order['created_at']))
        if week >= cutoff:
            excluded_orders += 1
            continue
        included_orders += 1
        # Gross recorded intent: include ultimately cancelled/unpaid orders.
        # Their final states cannot reconstruct historical net accepted demand.
        bookings[week] = bookings.get(week, 0) + sum(item['quantity'] for item in order['items'])
    if not bookings:
        raise ValueError('No completed booking weeks in the exported history.')
    weeks = pd.date_range(min(bookings), cutoff - timedelta(days=7), freq='W-MON')
    history = pd.DataFrame({'week_start': weeks,
                            'recorded_portions': [bookings.get(w.date(), 0) for w in weeks]})
    return history, {'included_orders': included_orders, 'excluded_current_or_future_week_orders': excluded_orders,
                     'snapshot_orders': len(data['orders']),
                     'snapshot_items': sum(len(o['items']) for o in data['orders']),
                     'positive_recorded_weeks': int((history.recorded_portions > 0).sum()),
                     'zero_recorded_weeks': int((history.recorded_portions == 0).sum())}


def features(history):
    frame = history.copy().sort_values('week_start').reset_index(drop=True)
    frame['lag1'] = frame.recorded_portions.shift(1).fillna(0)
    frame['lag2'] = frame.recorded_portions.shift(2).fillna(0)
    frame['rolling4'] = frame.recorded_portions.shift(1).rolling(4, min_periods=1).mean().fillna(0)
    frame['history_weeks'] = np.arange(len(frame), dtype=float)
    calendar_week = frame.week_start.dt.isocalendar().week.astype(float)
    frame['week_sin'] = np.sin(2 * math.pi * calendar_week / 52.18)
    frame['week_cos'] = np.cos(2 * math.pi * calendar_week / 52.18)
    return frame


def split(frame, holdout_weeks=4):
    if type(holdout_weeks) is not int or holdout_weeks < 1 or len(frame) < holdout_weeks + 8:
        raise ValueError('Require at least eight earlier training weeks and a chronological holdout.')
    return frame.iloc[:-holdout_weeks].copy(), frame.iloc[-holdout_weeks:].copy()


def scores(actual, predicted):
    actual, predicted = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    error = np.abs(actual - predicted)
    denominator = np.abs(actual).sum()
    return {'wape_percent': float(error.sum() / denominator * 100) if denominator else None,
            'mae_portions_per_week': float(error.mean())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--holdout-weeks', type=int, default=4)
    parser.add_argument('--assume-recorded-zero-weeks', action='store_true')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    original = Path(__file__).resolve().parent / 'artifacts'
    if output == original.resolve() or (output.exists() and any(output.iterdir())):
        parser.error('Use a new, empty candidate directory; preserve the Genpact model and previous experiments.')
    data = normalize_snapshot(json.loads(args.snapshot.read_text()))
    history, counts = booking_history(data, assume_recorded_zero_weeks=args.assume_recorded_zero_weeks)
    frame = features(history)
    train, valid = split(frame, args.holdout_weeks)
    if train.recorded_portions.nunique() < 2:
        raise ValueError('Training history has no target variation.')
    model = CatBoostRegressor(**PARAMETERS)
    model.fit(train[FEATURES], np.log1p(train.recorded_portions))
    predictions = np.maximum(0, np.expm1(model.predict(valid[FEATURES])))
    if not np.isfinite(predictions).all():
        raise ValueError('Candidate returned nonfinite predictions.')
    output.mkdir(parents=True, mode=0o700, exist_ok=True)
    output.chmod(0o700)
    model_path = output / 'local_booking_model.cbm'
    model.save_model(str(model_path))
    reloaded = CatBoostRegressor()
    reloaded.load_model(str(model_path))
    reloaded_predictions = np.maximum(0, np.expm1(reloaded.predict(valid[FEATURES])))
    np.testing.assert_allclose(reloaded_predictions, predictions, rtol=1e-10, atol=1e-10)
    valid['catboost_prediction'] = predictions
    valid['last_week_baseline'] = valid.lag1
    valid['trailing4_baseline'] = valid.rolling4
    model_scores = scores(valid.recorded_portions, predictions)
    last_scores = scores(valid.recorded_portions, valid.lag1)
    mean_scores = scores(valid.recorded_portions, valid.rolling4)
    encoded = json.dumps(data, sort_keys=True, separators=(',', ':')).encode()
    report = {'source': 'LOCAL_DATABASE_SNAPSHOT', 'provenance': data['provenance'],
              'snapshot_as_of': data['as_of'], 'snapshot_sha256': hashlib.sha256(encoded).hexdigest(),
              'target': 'Aggregate gross recorded booking portions per local Monday-Sunday week',
              'timezone': data['timezone'], 'features': FEATURES, 'parameters': PARAMETERS,
              'python_version': sys.version.split()[0],
              'dependency_versions': {name: version(name) for name in ('catboost', 'numpy', 'pandas')},
              'training_start': train.week_start.min().date().isoformat(),
              'training_end': train.week_start.max().date().isoformat(),
              'validation_start': valid.week_start.min().date().isoformat(),
              'validation_end': valid.week_start.max().date().isoformat(),
              'training_weeks': len(train), 'validation_weeks': len(valid), **counts,
              'validation_actual_portions': int(valid.recorded_portions.sum()),
              'catboost': model_scores, 'last_week_baseline': last_scores, 'trailing4_baseline': mean_scores,
              'beats_both_baselines': bool(model_scores['wape_percent'] is not None and
                  model_scores['wape_percent'] < min(last_scores['wape_percent'], mean_scores['wape_percent'])),
              'saved_model_reload_predictions_match': True,
              'promotion_eligible': False,
              'deployment_status': 'Offline experiment only; live APIs remain Genpact.',
              'limitations': [
                  'Missing weeks mean zero surviving recorded bookings, not verified zero customer demand.',
                  'Orders are owner-confirmed fictional demo records; evaluation is not real-business evidence.' if data['provenance'] == 'fictional_demo' else 'Recording coverage and business representativeness are unverified.',
                  'Includes cancelled and unpaid booking intent; does not forecast paid sales or fulfilled meals.',
                  'Only four holdout weeks by default; few positive weeks cannot establish reliable accuracy.',
                  'Rolling one-week validation uses actual earlier holdout counts, not recursive multiweek forecasts.',
                  'Menu identities/prices were reassigned; aggregate quantities avoid those labels but cannot forecast individual dishes.',
                  'Does not provide ingredient quantities, supplier deadlines, stock consumption, financial savings or safety guarantees.',
                  'Model parameters were fixed before holdout evaluation; no holdout-based hyperparameter tuning.']}
    history.to_csv(output / 'weekly_recorded_bookings.csv', index=False)
    valid[['week_start', 'recorded_portions', 'catboost_prediction', 'last_week_baseline', 'trailing4_baseline']].to_csv(
        output / 'validation_predictions.csv', index=False)
    (output / 'metrics.json').write_text(json.dumps(report, indent=2) + '\n')
    for path in output.iterdir():
        path.chmod(0o600)
    print(json.dumps(report, indent=2))
    print(f'Saved experimental model: {model_path}')


if __name__ == '__main__':
    main()
