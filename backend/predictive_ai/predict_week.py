"""Predict week 146, then score illustrative ingredient inventory risks."""
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
try:
    from .forecast_core import read_data, future_rows, FEATURES
    from .decision_engine import assess_risks
except ImportError:
    from forecast_core import read_data, future_rows, FEATURES
    from decision_engine import assess_risks

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--data-dir',default=str(Path(__file__).resolve().parent/'data'))
    p.add_argument('--model',default=str(Path(__file__).resolve().parent/'artifacts'/'demand_model.cbm'))
    p.add_argument('--week',type=int,default=None)
    p.add_argument('--center-id',type=int,default=None)
    p.add_argument('--promo',action='store_true')
    a=p.parse_args()
    d=Path(a.data_dir)
    batches=pd.read_csv(d/'inventory_batches_demo.csv')
    center=a.center_id if a.center_id is not None else int(batches.iloc[0].center_id)
    history=read_data(d)
    last_observed=int(history['week'].max())
    if a.week is None:
        a.week = last_observed + 1
    if a.week != last_observed + 1:
        raise ValueError(f'This starter only supports one-week-ahead forecasts: select week {last_observed+1}, not {a.week}.')
    rows=future_rows(history,week=a.week,center_id=center,promo=a.promo)
    model=CatBoostRegressor()
    model.load_model(a.model)
    rows['predicted_orders']=np.maximum(0,np.expm1(model.predict(rows[FEATURES])))
    forecasts=rows[['center_id','meal_id','week','predicted_orders']].copy()
    risks=assess_risks(forecasts,pd.read_csv(d/'recipes_demo.csv'),batches,
                       pd.read_csv(d/'supplier_settings_demo.csv'),center,a.week)
    result={'week':a.week,'center_id':center,'promotion_scenario':a.promo,
            'data_note':'Raw demand history is sourced from Genpact. Recipes, inventory, costs, promotion counterfactual are demo-only assumptions.',
            'meal_forecasts':[{k:(int(v) if k in ['center_id','meal_id','week'] else round(float(v),1))
                               for k,v in item.items()} for item in forecasts.to_dict('records')],
            'ingredient_risks':risks}
    out=Path(__file__).resolve().parent/'artifacts';out.mkdir(exist_ok=True,parents=True)
    (out/'demo_output.json').write_text(json.dumps(result,indent=2))
    print('Saved forecast and inventory assessment to artifacts/demo_output.json')
    print(json.dumps({'center_id':center,'week':a.week,'ingredient_risks':risks},indent=2))

if __name__=='__main__':
    main()
