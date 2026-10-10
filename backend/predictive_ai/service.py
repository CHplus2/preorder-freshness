"""Optional read-only CatBoost integration. No FYP product/stock mapping or writes."""
import json
from functools import lru_cache
from pathlib import Path
from django.conf import settings


class PredictiveError(Exception):
    def __init__(self, code, detail, status=503):
        self.code,self.detail,self.status=code,detail,status


def paths():
    root=Path(__file__).resolve().parent
    return Path(getattr(settings,'PREDICTIVE_DATA_DIR',root/'data')),Path(getattr(settings,'PREDICTIVE_ARTIFACT_DIR',root/'artifacts'))


def signature(files):
    return tuple((str(p),p.stat().st_mtime_ns,p.stat().st_size) for p in files)


@lru_cache(maxsize=2)
def load_bundle(key):
    import pandas as pd
    from catboost import CatBoostRegressor
    from .forecast_core import read_data, FEATURES
    data=Path(key[0][0]).parent
    artifact=Path(key[-1][0]).parent
    history=read_data(data)
    model=CatBoostRegressor(); model.load_model(str(artifact/'demand_model.cbm'))
    if model.feature_names_!=FEATURES:
        raise ValueError('Incompatible model features')
    metrics=json.loads((artifact/'metrics.json').read_text())
    if not all(k in metrics for k in ('train_max_week','model_wape_percent','lag1_baseline_wape_percent','validation_rows')):
        raise ValueError('Incomplete metrics')
    centers=pd.read_csv(data/'fulfilment_center_info.csv')
    return history,model,metrics,centers


def bundle():
    data,artifact=paths()
    source=[data/name for name in ('train.csv','meal_info.csv','fulfilment_center_info.csv')]
    if not all(p.is_file() for p in source):
        raise PredictiveError('source_data_unavailable','Provision the three Genpact source CSVs.')
    files=source+[artifact/'metrics.json',artifact/'demand_model.cbm']
    if not all(p.is_file() for p in files):
        raise PredictiveError('model_unavailable','Provision the evaluated model and metrics.')
    try: return load_bundle(signature(files))
    except Exception as exc:
        raise PredictiveError('model_unavailable','Model dependencies, artifact or source schema are incompatible.') from exc


def parameters(values, history, scenario=False):
    allowed={'center_id','week','promotion_scenario'} if scenario else {'center_id','week'}
    if set(values)-allowed:
        raise PredictiveError('invalid_parameters','Unknown parameters.',400)
    def integer(value):
        if isinstance(value,bool) or not str(value).isascii() or not str(value).isdigit():
            raise PredictiveError('invalid_parameters','center_id and week must be positive integers.',400)
        return int(value)
    center=integer(values.get('center_id',''))
    week=integer(values.get('week',int(history.week.max())+1))
    if center not in set(history.center_id):
        raise PredictiveError('invalid_parameters','Unknown center_id.',400)
    if week!=int(history.week.max())+1:
        raise PredictiveError('invalid_parameters',f'Only week {int(history.week.max())+1} is supported.',400)
    promo=values.get('promotion_scenario',False)
    if not isinstance(promo,bool):
        raise PredictiveError('invalid_parameters','promotion_scenario must be a JSON boolean.',400)
    return center,week,promo


def forecast(values, scenario=False):
    history,model,_,_=bundle()
    center,week,promo=parameters(values,history,scenario)
    import numpy as np
    import pandas as pd
    from .forecast_core import future_rows,FEATURES
    from .decision_engine import assess_risks
    try: rows=future_rows(history,week,center,promo)
    except ValueError as exc: raise PredictiveError('no_eligible_history','No eligible history for this center.',422) from exc
    rows['predicted_orders']=np.maximum(0,np.expm1(model.predict(rows[FEATURES],thread_count=2)))
    if not np.isfinite(rows.predicted_orders).all():
        raise PredictiveError('model_unavailable','Model returned nonfinite predictions.')
    forecasts=rows[['center_id','meal_id','week','predicted_orders']].copy()
    for col in ('center_id','meal_id','week'): forecasts[col]=forecasts[col].astype(int)
    data,_=paths()
    try:
        recipes=pd.read_csv(data/'recipes_demo.csv'); batches=pd.read_csv(data/'inventory_batches_demo.csv'); suppliers=pd.read_csv(data/'supplier_settings_demo.csv')
        if not all('data_origin' in frame and frame.data_origin.eq('SIMULATED').all() for frame in (recipes,batches,suppliers)):
            raise ValueError('Only explicitly simulated operations are supported')
        if not batches.center_id.eq(center).any():
            raise ValueError('No simulated batches for this center')
        risks,allocations,warnings=assess_risks(forecasts,recipes,batches,suppliers,center,week,details=True)
    except (OSError,ValueError,KeyError,AttributeError) as exc:
        raise PredictiveError('operational_data_unavailable','Valid SIMULATED operations are required for this center.') from exc
    warnings.append('Weekly external prototype; prices carried forward. Promotion flags are assumptions, not causal uplift. Supplier lead times are unverified.')
    return dict(api_version='1',center_id=center,week=week,horizon_weeks=1,promotion_scenario=promo,
        sources=dict(demand='GENPACT_HISTORICAL',operational='SIMULATED',product_mapping='UNMAPPED'),
        meal_forecasts=forecasts.to_dict('records'),ingredient_risks=risks,batch_allocations=allocations,warnings=warnings)
