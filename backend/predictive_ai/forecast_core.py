"""Weekly demand feature creation. Uses only past orders for every target week."""
from pathlib import Path
import pandas as pd

CAT = ['center_id', 'meal_id', 'category', 'cuisine', 'center_type']
NUM = ['week', 'checkout_price', 'base_price', 'emailer_for_promotion',
       'homepage_featured', 'op_area', 'lag1', 'lag2', 'rolling4', 'weeks_since_last']
FEATURES = CAT + NUM

def read_data(data_dir='data'):
    p = Path(data_dir)
    sales = pd.read_csv(p / 'train.csv')
    meal = pd.read_csv(p / 'meal_info.csv')
    center = pd.read_csv(p / 'fulfilment_center_info.csv')
    required = {'week', 'center_id', 'meal_id', 'num_orders', 'checkout_price',
                'base_price', 'emailer_for_promotion', 'homepage_featured'}
    missing = required - set(sales.columns)
    if missing:
        raise ValueError(f'Missing train.csv columns: {sorted(missing)}')
    df = sales.merge(meal, on='meal_id', how='left', validate='many_to_one')
    df = df.merge(center, on='center_id', how='left', validate='many_to_one')
    df = df.sort_values(['center_id', 'meal_id', 'week']).reset_index(drop=True)
    return df

def historical_features(df):
    df = df.copy().sort_values(['center_id', 'meal_id', 'week']).reset_index(drop=True)
    g = df.groupby(['center_id', 'meal_id'], sort=False)
    df['lag1'] = g['num_orders'].shift(1)
    df['lag2'] = g['num_orders'].shift(2)
    df['rolling4'] = g['num_orders'].transform(lambda s: s.shift(1).rolling(4, min_periods=1).mean())
    df['weeks_since_last'] = df['week'] - g['week'].shift(1)
    return clean_features(df)

def clean_features(df):
    df = df.copy()
    for c in CAT:
        df[c] = df[c].fillna('Unknown').astype(str)
    for c in NUM:
        df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0).astype(float)
    return df

def future_rows(df, week, center_id=None, promo=False):
    """Create a one-week-ahead forecast for observed center/meal combinations."""
    df = df.loc[df['week'] < week].copy().sort_values(['center_id','meal_id','week'])
    if center_id is not None:
        df = df.loc[df['center_id'] == int(center_id)].copy()
    if df.empty:
        raise ValueError('No historical rows before selected future week')
    grp = df.groupby(['center_id','meal_id'],sort=False)
    rows = []
    for (_, _), h in grp:
        latest = h.iloc[-1].copy()
        if week - int(latest['week']) > 10:
            continue  # do not forecast dormant menu items
        latest['week'] = int(week)
        latest['lag1'] = float(h.iloc[-1]['num_orders'])
        latest['lag2'] = float(h.iloc[-2]['num_orders']) if len(h) >= 2 else 0.0
        latest['rolling4'] = float(h['num_orders'].tail(4).mean())
        latest['weeks_since_last'] = int(week - h.iloc[-1]['week'])
        # Promotion changes are user-specified scenarios, not causal conclusions.
        latest['emailer_for_promotion'] = int(bool(promo))
        latest['homepage_featured'] = int(bool(promo))
        rows.append(latest)
    if not rows:
        raise ValueError('No active menu items to forecast')
    return clean_features(pd.DataFrame(rows))
