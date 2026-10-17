import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {default:StockFlowEvidence}=await server.ssrLoadModule('/src/features/predictive/StockFlowEvidence.jsx');
 const flow={opening_quantity:5400,after_confirmed:5400,confirmed_allocated:0,forecast_consumed:4870.986,
  projected_total_remaining:529.014,projected_expiring_unused:196.891,projected_carried_stock:332.123,
  allocations:[{date:'2026-10-18',batch_id:1,quantity:1603.109},{date:'2026-10-21',batch_id:2,quantity:3267.877}],
  demand_by_day:[{date:'2026-10-18',forecast_requirement:1603.109,forecast_consumed:1603.109,
    menus:[{product_id:1,product_name:'Mee Goreng Telur',additional_portions:16.03109,quantity_per_portion:100,requirement:1603.109}]}],
  batches:[{batch_id:1,expiry_date:'2026-10-19',opening_quantity:1800,confirmed_allocated:0,after_confirmed:1800,forecast_consumed:1603.109,
   projected_remaining:196.891,expires_in_window:true,unit_cost:.006},
   {batch_id:2,expiry_date:'2026-10-31',opening_quantity:3600,confirmed_allocated:0,after_confirmed:3600,forecast_consumed:3267.877,
    projected_remaining:332.123,expires_in_window:false,unit_cost:null}]};
 const render=risk=>renderToStaticMarkup(createElement(StockFlowEvidence,{risk,window:{start_date:'2026-10-17',end_date:'2026-10-23',horizon_days:7}}));
 const risk={unit:'g',forecast_requirement:4870.986,forecast_shortfall:0,forecast_expiring_unused:196.891,stock_flow:flow};
 const html=render(risk);
 for(const value of ['529.014 g remaining','196.891','332.123','Unknown'])assert.ok(html.includes(value),value);
 assert.match(html,/Projected waste within this window/);
 assert.match(html,/Carried beyond this window/);
 assert.match(html,/no stock deducted/);
 assert.match(html,/Exact expiry calculation/);
 assert.match(html,/forecast use before expiry/);
 assert.match(html,/Mee Goreng Telur/);
 assert.match(html,/additional portions ×/);
 assert.match(html,/Demand after 2026-10-19 cannot rescue this batch/);
 assert.ok(html.indexOf('Expires 2026-10-19') < html.indexOf('Whole-stock balance'));
 assert.match(render({...risk,forecast_expiring_unused:0}),/zero projected waste can coexist with a shortage/);
 assert.match(render({...risk,stock_flow:undefined}),/Stock dated later carries forward/);
 const {default:KitchenForecastReplay}=await server.ssrLoadModule('/src/features/predictive/KitchenForecastReplay.jsx');
 const scores=Object.fromEntries(['mean_28','mean_7','same_weekday'].map(key=>[key,{mae:1.12,wape_percent:46.22,daily_actual:[2],daily_predictions:[1]}]));
 const menu={product_id:1,product_name:'Mee Goreng Telur',method:'mean_28',synthetic_history_items:70,
   forecast_portions:16.21,additional_forecast_portions:13.89,history_days:112,price_myr:10,confidence:'evaluated',recipe_complete:true,
   evaluation:{train_days:84,validation_days:14,test_days:14,test:scores,
     planning_horizon_test:{horizon_days:7,test:Object.fromEntries(Object.keys(scores).map(key=>[key,{windows:8,mae:2,wape_percent:60,window_total_mae:5}]))}}};
 const replay=renderToStaticMarkup(createElement(KitchenForecastReplay,{menus:[menu]}));
 assert.match(replay,/not proven to be the best possible model/);
 assert.match(replay,/7-day window/);
 assert.match(replay,/Synthetic-data evaluation/);
 assert.match(replay,/not an accuracy percentage/);
 const unvalidated={...menu,evaluation:{...menu.evaluation,planning_horizon_test:{horizon_days:28,test:{...menu.evaluation.planning_horizon_test.test,mean_28:{windows:0,mae:null,wape_percent:null,window_total_mae:null}}}}};
 assert.match(renderToStaticMarkup(createElement(KitchenForecastReplay,{menus:[unvalidated]})),/This horizon is unvalidated/);
 const {default:KitchenDecisionJourney}=await server.ssrLoadModule('/src/features/predictive/KitchenDecisionJourney.jsx');
 const selected={...risk,ingredient_id:'raw-material-1',raw_material_id:1,ingredient_name:'Fresh yellow noodles',
   signal:'review',shortfall_quantity:0,confirmed_requirement:0,eligible_stock:5400,forecast_waste_cost_myr:1.18,
   waste_sensitivity_low:0,waste_sensitivity_high:1078.495,alert_reason:'Generated history needs verification',
   explanation:'Confirmed-only stock is not the forecast result.',menus:[{product_id:1,product_name:menu.product_name,quantity_per_portion:100}]};
 const plan={as_of:'2026-10-17',window:{start_date:'2026-10-17',end_date:'2026-10-23',horizon_days:7},coverage:{excluded_orders:0},
   decision_support:{menus:[menu],ingredient_risks:[selected],alert_count:0,review_count:1,assumptions:[]}};
 const journey=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/admin/ai/decisions?source=local&step=1']},
   createElement(KitchenDecisionJourney,{plan,comparison:null,onComparison:()=>{},onClear:()=>{}})));
 assert.ok(journey.indexOf('Where the forecast need comes from')<journey.indexOf('Confirmed-only stock is not the forecast result.'));
 assert.match(journey,/Inspect batches &amp; exact calculations/);
 assert.match(journey,/From expiring stock/);
 assert.match(journey,/From later stock/);
 assert.match(journey,/Central forecast · Step 1 result/);
 assert.match(journey,/Lower demand → more unused/);
 assert.doesNotMatch(journey,/Projected waste sensitivity:/);
 const {default:KitchenPurchaseComparison}=await server.ssrLoadModule('/src/features/predictive/KitchenPurchaseComparison.jsx');
 const comparedRisk={...selected,forecast_waste_cost_myr:2,potential_waste_cost_myr:2,expiring_unused_quantity:196.891};
 const comparison={purchase:{raw_material_id:1},baseline:{ingredient_risks:[comparedRisk],decision_support:{ingredient_risks:[comparedRisk]}},
   scenario:{ingredient_risks:[comparedRisk],decision_support:{ingredient_risks:[comparedRisk]}}};
 const purchase=renderToStaticMarkup(createElement(KitchenPurchaseComparison,{plan,risk:{...selected,forecast_waste_cost_myr:999,potential_waste_cost_myr:999},comparison,onComparison:()=>{},onClear:()=>{},onWorksheet:()=>{}}));
 assert.doesNotMatch(purchase,/999/);
 assert.match(purchase,/2\.00/);
 console.log('Stock flow: expiry waste, carried stock, total balance, unknown cost and zero-waste explanation passed.');
} finally {await server.close();}
