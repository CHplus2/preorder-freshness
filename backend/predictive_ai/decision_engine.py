"""FEFO-aware weekly risk assessment. Quantities, dates, costs are user data or simulated."""
import pandas as pd

def assess_risks(forecasts, recipes, batches, suppliers, center_id, week):
    f=forecasts.loc[forecasts.center_id.astype(int)==int(center_id),['meal_id','predicted_orders']].copy()
    f['meal_id']=f.meal_id.astype(int)
    r=recipes.copy(); r['meal_id']=r.meal_id.astype(int)
    requirements=(f.merge(r,on='meal_id',how='inner')
                  .assign(required_kg=lambda x:x.predicted_orders*x.qty_per_order_kg)
                  .groupby('ingredient_id',as_index=False)['required_kg'].sum())
    inv=batches[batches.center_id.astype(int)==int(center_id)].copy()
    records=[]
    for _, req in requirements.iterrows():
        ing=req.ingredient_id; demand=float(req.required_kg)
        lots=inv[(inv.ingredient_id==ing)&(inv.expiry_week>=week)].sort_values('expiry_week')
        available=float(lots.quantity_kg.sum())
        remaining_need=demand
        expiring_unused=0.
        for _,lot in lots.iterrows():
            consumed=min(float(lot.quantity_kg),remaining_need)
            remaining_need=max(0.,remaining_need-consumed)
            if int(lot.expiry_week)==int(week):
                expiring_unused+=float(lot.quantity_kg)-consumed
        unit_cost=float(lots.iloc[0].cost_per_kg_myr) if not lots.empty else 0.
        cfg=suppliers[suppliers.ingredient_id==ing]
        safety=float(cfg.iloc[0].safety_stock_kg) if not cfg.empty else 0.
        reorder=max(0.,demand+safety-available)
        loss=expiring_unused*unit_cost
        issue='Projected expiry surplus' if expiring_unused>0.01 else ('Projected shortage' if remaining_need>0.01 else 'No immediate risk')
        action='Prioritize ingredient use; evaluate promotion carefully and reduce future purchasing' if expiring_unused>0.01 else ('Replenish before shortage' if remaining_need>0.01 else 'Maintain purchasing policy')
        records.append({'ingredient_id':ing,'risk_type':issue,
            'forecast_demand_kg':round(demand,2),'available_kg':round(available,2),
            'expiring_unused_kg':round(expiring_unused,2),'potential_waste_cost_myr':round(loss,2),
            'shortfall_kg':round(remaining_need,2),'illustrative_reorder_kg':round(reorder,2),
            'action':action,'explanation':f'Forecast use {demand:.1f}kg; eligible stock {available:.1f}kg; expiring unused {expiring_unused:.1f}kg in week {week}.',
            'risk_inputs_note':'Expiry batches, ingredient recipes and costs are illustrative unless replaced with real business records.'})
    return sorted(records,key=lambda x:(x['potential_waste_cost_myr'],x['shortfall_kg']),reverse=True)
