"""Reload the trained artifact and independently reproduce chronological WAPE.

Run from the repository root with the ML interpreter. No retraining or database use.
"""
import json
from pathlib import Path
import numpy as np
from catboost import CatBoostRegressor
from backend.predictive_ai.forecast_core import read_data, historical_features, FEATURES
from backend.predictive_ai.train_model import wape


def main():
    root=Path(__file__).resolve().parent
    metrics=json.loads((root/'artifacts/metrics.json').read_text())
    history=historical_features(read_data(root/'data'))
    holdout=history[history.week>metrics['train_max_week']].copy()
    assert len(holdout)==metrics['validation_rows']
    assert int(holdout.week.min())==metrics['validation_start_week']
    assert int(holdout.week.max())==metrics['validation_end_week']
    model=CatBoostRegressor()
    model.load_model(str(root/'artifacts/demand_model.cbm'))
    holdout['predicted_orders']=np.maximum(0,np.expm1(model.predict(holdout[FEATURES])))
    assert np.isfinite(holdout.predicted_orders).all()
    actual=holdout.num_orders.to_numpy()
    baseline=holdout.lag1.to_numpy()
    model_wape=wape(actual,holdout.predicted_orders)
    baseline_wape=wape(actual,baseline)
    assert round(model_wape,2)==metrics['model_wape_percent']
    assert round(baseline_wape,2)==metrics['lag1_baseline_wape_percent']
    result={'reloaded_artifact_metrics_match':True,
            'model_wape_percent':model_wape,
            'lag1_baseline_wape_percent':baseline_wape,
            'relative_wape_reduction_percent':100*(baseline_wape-model_wape)/baseline_wape,
            'per_week':[]}
    for week,rows in holdout.groupby('week'):
        result['per_week'].append({'week':int(week),'rows':len(rows),
            'model_wape_percent':wape(rows.num_orders,rows.predicted_orders),
            'lag1_baseline_wape_percent':wape(rows.num_orders,rows.lag1)})
    holdout[['center_id','meal_id','week','num_orders','predicted_orders','lag1']].to_csv(
        root/'artifacts/validation_predictions.csv',index=False)
    (root/'artifacts/evaluation_details.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    main()
