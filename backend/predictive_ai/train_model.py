"""Train 1-week rolling demand forecasting model on 456,548-row food dataset."""
import argparse
import json
from pathlib import Path
import numpy as np
from catboost import CatBoostRegressor
try:
    from .forecast_core import read_data, historical_features, CAT, FEATURES
except ImportError:
    from forecast_core import read_data, historical_features, CAT, FEATURES

def wape(actual, pred):
    return float(np.sum(np.abs(np.asarray(actual)-np.asarray(pred))) / max(np.sum(np.abs(actual)), 1) * 100)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', default=str(Path(__file__).resolve().parent/'data'))
    parser.add_argument('--output-dir', default=str(Path(__file__).resolve().parent/'artifacts'))
    args = parser.parse_args()
    df = historical_features(read_data(args.data_dir))
    # Train strictly earlier weeks; last 10 known weeks simulate unseen future.
    max_week = int(df['week'].max())
    cutoff = max_week - 10
    train = df[(df.week <= cutoff) & (df.week >= 4)]
    valid = df[df.week > cutoff]
    if train.empty or valid.empty:
        raise ValueError('Not enough distinct weeks to train and validate')
    target_train = np.log1p(train['num_orders'].clip(lower=0))
    model = CatBoostRegressor(iterations=200, depth=6, learning_rate=0.08,
                            loss_function='RMSE', verbose=False, random_seed=42,
                            thread_count=4)
    model.fit(train[FEATURES], target_train, cat_features=CAT)
    predicted = np.maximum(0, np.expm1(model.predict(valid[FEATURES])))
    actual = valid['num_orders'].to_numpy()
    naive = valid['lag1'].clip(lower=0).to_numpy()
    metrics = {
        'train_max_week': cutoff, 'validation_start_week': cutoff + 1,
        'validation_end_week': max_week, 'train_rows': len(train),
        'validation_rows': len(valid),
        'model_wape_percent': round(wape(actual, predicted), 2),
        'lag1_baseline_wape_percent': round(wape(actual, naive), 2),
        'model_beats_baseline': bool(wape(actual,predicted) < wape(actual,naive)),
        'warning': 'Validation is rolling one-step ahead using actual prior observations. It does not measure multi-week recursive accuracy.'
    }
    out = Path(args.output_dir)
    out.mkdir(exist_ok=True, parents=True)
    model.save_model(str(out/'demand_model.cbm'))
    (out/'metrics.json').write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))
    print(f'Saved trained model to {out / "demand_model.cbm"}')

if __name__ == '__main__':
    main()
