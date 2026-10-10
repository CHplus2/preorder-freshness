"""Offline named-food benchmark; never imports public rows into the shop database."""
import argparse
from datetime import timedelta
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from catboost import CatBoostRegressor
import numpy as np
import pandas as pd

SOURCE_URL = ('https://raw.githubusercontent.com/ibaburbek/bakery_sales_pbi/'
              'e399f2b82d54e35c7e3d92d8b6d2b45425d45762/Bakery%20sales.csv')
SOURCE_SHA256 = 'af5eede55b6eb2efb6bebb0e6dd1a51568c7eb73554d2f8ad2563081025681b2'
# Fixed named-food scope; excludes non-food/services such as COUPE.
PRODUCTS = ['TRADITIONAL BAGUETTE', 'BAGUETTE', 'BANETTE', 'CROISSANT', 'PAIN AU CHOCOLAT']
CAT = ['article', 'weekday', 'month']
FEATURES = CAT + ['day_index', 'lag1', 'lag7', 'lag14', 'lag28', 'rolling7', 'rolling28', 'weekday_mean4']
PARAMETERS = dict(iterations=400, depth=6, learning_rate=.05, loss_function='MAE',
                  random_seed=42, thread_count=2, verbose=False, allow_writing_files=False)


def daily_history(path):
    raw = pd.read_csv(path)
    required = {'date', 'time', 'ticket_number', 'article', 'Quantity', 'unit_price'}
    if not required.issubset(raw.columns):
        raise ValueError('Expected documented bakery transaction columns.')
    raw['date'] = pd.to_datetime(raw.date, format='%Y-%m-%d', errors='raise')
    raw['Quantity'] = pd.to_numeric(raw.Quantity, errors='raise')
    if raw[list(required)].isna().any().any() or not np.isfinite(raw.Quantity).all():
        raise ValueError('Missing or nonfinite source values.')
    if set(PRODUCTS) - set(raw.article):
        raise ValueError('Selected bakery products are absent.')
    days = pd.date_range(raw.date.min(), raw.date.max(), freq='D')
    selected = raw[raw.article.isin(PRODUCTS)]
    grouped = selected.groupby(['article', 'date']).Quantity.sum()
    grid = pd.MultiIndex.from_product([PRODUCTS, days], names=['article', 'date'])
    daily = grouped.reindex(grid, fill_value=0).rename('recorded_units').reset_index()
    if (daily.recorded_units < 0).any():
        raise ValueError('Selected daily net quantities contain negative totals; review adjustments.')
    return daily, {'source_rows': len(raw), 'source_tickets': int(raw.ticket_number.nunique()),
                   'source_articles': int(raw.article.nunique()), 'source_observed_days': int(raw.date.nunique()),
                   'calendar_days': len(days), 'calendar_days_without_records': len(days) - raw.date.nunique(),
                   'source_negative_quantity_rows': int((raw.Quantity < 0).sum()),
                   'selected_source_rows': len(selected),
                   'duplicate_business_rows': int(raw[list(sorted(required))].duplicated().sum())}


def features(daily):
    frame = daily.sort_values(['article', 'date']).reset_index(drop=True).copy()
    group = frame.groupby('article', sort=False).recorded_units
    for lag in (1, 7, 14, 28):
        frame[f'lag{lag}'] = group.shift(lag)
    for window in (7, 28):
        frame[f'rolling{window}'] = group.transform(lambda s: s.shift(1).rolling(window, min_periods=1).mean())
    past_weekdays = pd.concat([group.shift(i) for i in (7, 14, 21, 28)], axis=1)
    frame['weekday_mean4'] = past_weekdays.mean(axis=1)
    frame['weekday'] = frame.date.dt.dayofweek.astype(str)
    frame['month'] = frame.date.dt.month.astype(str)
    frame['day_index'] = (frame.date - frame.date.min()).dt.days.astype(float)
    frame[FEATURES[len(CAT):]] = frame[FEATURES[len(CAT):]].fillna(0)
    return frame


def scores(actual, predicted):
    error = np.abs(np.asarray(actual) - np.asarray(predicted))
    denominator = np.abs(actual).sum()
    return {'wape_percent': float(error.sum() / denominator * 100) if denominator else None,
            'mae_units_per_product_day': float(error.mean())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--assume-recorded-zero-days', action='store_true')
    args = parser.parse_args()
    if not args.assume_recorded_zero_days:
        parser.error('Acknowledge that absent days mean zero recorded sales, not verified zero demand.')
    output = args.output_dir.resolve()
    if output == (Path(__file__).parent / 'artifacts').resolve() or (output.exists() and any(output.iterdir())):
        parser.error('Use a new empty candidate directory; preserve all existing models.')
    source_hash = hashlib.sha256(args.csv.read_bytes()).hexdigest()
    if source_hash != SOURCE_SHA256:
        parser.error('Source checksum differs from the audited immutable mirror.')
    daily, audit = daily_history(args.csv)
    frame = features(daily)
    validation_start = pd.Timestamp(frame.date.max().date() - timedelta(days=27))
    train = frame[frame.date < validation_start]
    valid = frame[frame.date >= validation_start].copy()
    if train.date.nunique() < 84 or valid.recorded_units.sum() <= 0:
        raise ValueError('Insufficient training or positive chronological holdout.')
    model = CatBoostRegressor(**PARAMETERS)
    model.fit(train[FEATURES], train.recorded_units, cat_features=CAT)
    predicted = np.maximum(0, model.predict(valid[FEATURES]))
    if not np.isfinite(predicted).all():
        raise ValueError('Nonfinite model predictions.')
    valid['catboost_prediction'] = predicted
    methods = {'catboost': predicted, 'previous_day': valid.lag1,
               'previous_weekday': valid.lag7, 'four_week_weekday_mean': valid.weekday_mean4}
    metrics = {name: scores(valid.recorded_units, values) for name, values in methods.items()}
    report = {'source_url': SOURCE_URL, 'source_sha256': source_hash,
              'original_dataset_url': 'https://www.kaggle.com/datasets/matthieugimbert/french-bakery-daily-sales',
              'provenance': 'Public mirror describes French bakery transactions; original provenance/license not independently verified.',
              'target': 'Net recorded item units sold per product per source calendar day',
              'products': PRODUCTS, 'features': FEATURES, 'parameters': PARAMETERS,
              'dependency_versions': {n: version(n) for n in ('catboost', 'pandas', 'numpy')}, **audit,
              'train_start': str(train.date.min().date()), 'train_end': str(train.date.max().date()),
              'validation_start': str(validation_start.date()), 'validation_end': str(valid.date.max().date()),
              'training_rows': len(train), 'validation_rows': len(valid),
              'validation_recorded_units': float(valid.recorded_units.sum()), 'metrics': metrics,
              'beats_all_baselines': bool(metrics['catboost']['wape_percent'] <
                  min(metrics[n]['wape_percent'] for n in metrics if n != 'catboost')),
              'model_reload_predictions_match': True, 'deployment_status': 'OFFLINE_BENCHMARK',
              'limitations': [
                  'Public bakery sales are not orders from the owner\'s original store.',
                  'Missing calendar days are zero recorded sales, not verified closure or zero demand.',
                  'Signed quantities are retained as recorded adjustments; duplicate business rows are not silently removed.',
                  'Observed sales do not reveal lost demand during stockouts or recording coverage.',
                  'Rolling one-day holdout uses actual earlier days; not a simultaneous 28-day forecast.',
                  'No price feature: future prices, promotion plans and opening schedules are unknown.',
                  'Fixed parameters and five named products; no tuning on this final holdout.',
                  'Source dates are historical, not today; timezone/operating calendar not independently established.',
                  'Dataset has no recipes, ingredient inventory, expiry dates or verified savings.',
                  'Source prices are EUR strings; no conversion into store MYR values is assumed.',
                  'No database imports, production deployments or frontend changes performed.']}
    output.mkdir(parents=True, mode=0o700, exist_ok=True)
    output.chmod(0o700)
    model.save_model(str(output / 'bakery_demand_model.cbm'))
    reloaded = CatBoostRegressor()
    reloaded.load_model(str(output / 'bakery_demand_model.cbm'))
    np.testing.assert_allclose(np.maximum(0, reloaded.predict(valid[FEATURES])), predicted, rtol=1e-10, atol=1e-10)
    valid[['article', 'date', 'recorded_units', 'catboost_prediction', 'lag1', 'lag7', 'weekday_mean4']].to_csv(
        output / 'validation_predictions.csv', index=False)
    daily.to_csv(output / 'daily_recorded_sales.csv', index=False)
    columns = {'catboost': 'catboost_prediction', 'previous_day': 'lag1',
               'previous_weekday': 'lag7', 'four_week_weekday_mean': 'weekday_mean4'}
    per_product = {name: {method: scores(part.recorded_units, part[column])
                        for method, column in columns.items()}
                   for name, part in valid.groupby('article')}
    report['per_product_metrics'] = per_product
    (output / 'metrics.json').write_text(json.dumps(report, indent=2) + '\n')
    for path in output.iterdir():
        path.chmod(0o600)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
