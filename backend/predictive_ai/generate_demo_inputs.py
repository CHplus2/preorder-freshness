"""Generate clearly fictional recipes, inventory batches and supplier settings matching REAL meal IDs.
Runs after users have downloaded public Genpact/Analytics Vidhya sales files.
"""
import argparse
from pathlib import Path
import pandas as pd

# EXPLICITLY illustrative recipes, not actual Genpact meal ingredients.
RECIPE_TEMPLATES = [
    [('Chicken',0.15),('Rice',0.20),('Cooking Oil',0.02)],
    [('Chicken',0.12),('Vegetables',0.18),('Cooking Oil',0.02)],
    [('Rice',0.15),('Vegetables',0.22),('Cooking Oil',0.02)],
    [('Chicken',0.20),('Vegetables',0.12),('Rice',0.10)],
    [('Rice',0.10),('Vegetables',0.25),('Cooking Oil',0.01)]
]
COSTS = {'Chicken':15., 'Rice':5., 'Vegetables':6., 'Cooking Oil':9.}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir',default=str(Path(__file__).resolve().parent/'data'))
    parser.add_argument('--week',type=int,default=None)
    args=parser.parse_args()
    d = Path(args.data_dir)
    train = pd.read_csv(d/'train.csv')
    if args.week is None:
        args.week = int(train['week'].max()) + 1
    meal_info = pd.read_csv(d/'meal_info.csv')
    recent=train[train.week>=train.week.max()-7]
    center_id=int(recent.groupby('center_id')['num_orders'].sum().idxmax())
    subset=recent[recent.center_id==center_id]
    ids=subset.groupby('meal_id')['num_orders'].sum().nlargest(5).index.tolist()
    names=meal_info.set_index('meal_id')['category'].to_dict()
    recipes=[]
    for i, meal_id in enumerate(ids):
        for ing,qty in RECIPE_TEMPLATES[i]:
            recipes.append({'meal_id':int(meal_id),'demo_meal_label': f'{names.get(meal_id,"Meal")} #{meal_id}',
                            'ingredient_id':ing.lower().replace(' ','_'),'ingredient_name':ing,
                            'qty_per_order_kg':qty,'data_origin':'SIMULATED'})
    df=pd.DataFrame(recipes)
    df.to_csv(d/'recipes_demo.csv',index=False)
    avg=subset[subset.meal_id.isin(ids)].groupby('meal_id')['num_orders'].mean().to_dict()
    needed={ing:0. for ing in COSTS}
    for row in recipes:
        needed[row['ingredient_name']]+=avg.get(row['meal_id'],0)*row['qty_per_order_kg']
    batches=[]
    for i,(ing,required) in enumerate(needed.items()):
        factor=[1.7,1.5,0.75,1.2][i]
        qty=max(round(required*factor,2),1.)
        batches.append({'batch_id':f'DEMO-{i+1}','center_id':center_id,
             'ingredient_id':ing.lower().replace(' ','_'),'ingredient_name':ing,
             'quantity_kg':qty,'expiry_week':args.week,'cost_per_kg_myr':COSTS[ing],
             'data_origin':'SIMULATED'})
    pd.DataFrame(batches).to_csv(d/'inventory_batches_demo.csv',index=False)
    suppliers=[{'ingredient_id':ing.lower().replace(' ','_'),'lead_time_weeks':1,
                'safety_stock_kg':round(max(1,required*0.1),2),'data_origin':'SIMULATED'}
               for ing,required in needed.items()]
    pd.DataFrame(suppliers).to_csv(d/'supplier_settings_demo.csv',index=False)
    print(f'Created 3 fictional operational inputs in {d}. Demo center_id={center_id}, meal_ids={ids}')
    print('Important: these recipes and stock batches are GENERATED DEMO DATA, not real dataset facts.')

if __name__=='__main__':
    main()
