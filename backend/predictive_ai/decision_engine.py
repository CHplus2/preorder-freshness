"""Read-only weekly FEFO simulation using explicitly supplied operational inputs."""
import math
import pandas as pd


def assess_risks(forecasts, recipes, batches, suppliers, center_id, week, *, details=False):
    for frame, columns in [(forecasts,['predicted_orders']), (recipes,['qty_per_order_kg']),
                           (batches,['quantity_kg']), (suppliers,['safety_stock_kg'])]:
        for col in columns:
            if col not in frame or not frame[col].map(lambda v: math.isfinite(float(v)) and float(v)>=0).all():
                raise ValueError(f'{col} must contain finite nonnegative quantities')
    if recipes.duplicated(['meal_id','ingredient_id']).any():
        raise ValueError('Duplicate meal/ingredient recipe')
    if batches.batch_id.duplicated().any():
        raise ValueError('Duplicate batch_id')
    for value in batches.cost_per_kg_myr.dropna():
        if not math.isfinite(float(value)) or float(value)<0:
            raise ValueError('cost_per_kg_myr must be nonnegative or unknown')
    f=forecasts[forecasts.center_id.astype(int)==int(center_id)].copy()
    f['meal_id']=f.meal_id.astype(int)
    r=recipes.copy(); r['meal_id']=r.meal_id.astype(int)
    merged=f.merge(r,on='meal_id')
    required=(merged.predicted_orders*merged.qty_per_order_kg).groupby(merged.ingredient_id).sum().to_dict()
    inv=batches[batches.center_id.astype(int)==int(center_id)].copy()
    warnings=[]
    uncovered=sorted(set(f.meal_id)-set(r.meal_id))
    if uncovered:
        warnings.append(f'No simulated recipe for meal IDs: {uncovered}; their ingredient requirements are excluded.')
    records=[]; allocations=[]
    for ing in sorted(set(required)|set(inv.ingredient_id)):
        demand=float(required.get(ing,0)); need=demand; available=surplus=loss=0.; unknown=False
        lots=inv[inv.ingredient_id==ing].sort_values(['expiry_week','batch_id'])
        for lot in lots.itertuples():
            eligible=int(lot.expiry_week)>=week
            qty=float(lot.quantity_kg)
            consumed=min(qty,need) if eligible else 0.
            remaining=qty-consumed
            waste=remaining if eligible and int(lot.expiry_week)==week else 0.
            cost=None if pd.isna(lot.cost_per_kg_myr) else float(lot.cost_per_kg_myr)
            value=None if waste>0 and cost is None else waste*(cost or 0.)
            if eligible:
                available+=qty; need-=consumed; surplus+=waste
                if value is None: unknown=True
                else: loss+=value
            allocations.append(dict(batch_id=str(lot.batch_id),ingredient_id=ing,expiry_week=int(lot.expiry_week),
                eligible=eligible,exclusion_reason=None if eligible else 'expired',consumed_kg=consumed,
                remaining_kg=remaining,potential_waste_cost_myr=value))
        cfg=suppliers[suppliers.ingredient_id==ing]
        safety=float(cfg.iloc[0].safety_stock_kg) if not cfg.empty else 0.
        issue='expiry_surplus_and_shortage' if surplus>0 and need>0 else ('expiry_surplus' if surplus>0 else ('shortage' if need>0 else 'none'))
        action='Review expiring surplus and reduce future purchasing conservatively' if surplus>0 else ('Replenish before shortage; verify supplier lead time' if need>0 else 'Maintain purchasing policy')
        if unknown: warnings.append(f'Unknown surplus cost for {ing}; monetary risk cannot be fully ranked.')
        records.append(dict(ingredient_id=ing,risk_type=issue,forecast_demand_kg=demand,available_kg=available,
            expiring_unused_kg=surplus,potential_waste_cost_myr=None if unknown else loss,shortfall_kg=need,
            illustrative_reorder_kg=max(0.,demand+safety-available),action=action,
            explanation=f'Forecast use {demand:.1f}kg; eligible stock {available:.1f}kg; unused expiry surplus {surplus:.1f}kg in week {week}. Supplier delivery and promotion uplift are unverified.',
            risk_inputs_note='SIMULATED recipes, batches, costs and supplier assumptions; weekly buckets are not food-safety measurements.'))
    records.sort(key=lambda x:(-(x['potential_waste_cost_myr'] or 0),-x['expiring_unused_kg'],-x['shortfall_kg'],x['ingredient_id']))
    return (records,allocations,warnings) if details else records
