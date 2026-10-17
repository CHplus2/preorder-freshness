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
 assert.ok(html.indexOf('Use by 2026-10-19') < html.indexOf('Whole-stock balance'));
 assert.match(html,/<details><summary>Batch identity &amp; recorded cost<\/summary>/);
 assert.match(render({...risk,forecast_expiring_unused:0}),/zero projected waste can coexist with a shortage/);
 assert.match(render({...risk,stock_flow:undefined}),/Stock dated later carries forward/);
 const {default:KitchenForecastReplay}=await server.ssrLoadModule('/src/features/predictive/KitchenForecastReplay.jsx');
 const {ZeroWasteNotice,DecisionSteps,SourceNotice,BuildIdentity,SourceSelector}=await server.ssrLoadModule('/src/features/predictive/FreshCastChrome.jsx');
 const zero=renderToStaticMarkup(createElement(ZeroWasteNotice,{waste:0,carried:332.123,unit:'g'}));
 assert.match(zero,/332.123 g/);assert.match(zero,/later-expiring stock/);assert.match(zero,/does not guarantee/);
 assert.equal(renderToStaticMarkup(createElement(ZeroWasteNotice,{waste:null,unit:'g'})),'');
 assert.equal(renderToStaticMarkup(createElement(ZeroWasteNotice,{waste:10,unit:'g'})),'');
 const nav=renderToStaticMarkup(createElement(DecisionSteps,{step:1,onChange:()=>{}}));
 assert.equal((nav.match(/<button/g)||[]).length,5);assert.equal((nav.match(/aria-current="step"/g)||[]).length,1);
 assert.match(renderToStaticMarkup(createElement(SourceNotice,{source:'live'})),/simulated stock/);
 assert.match(renderToStaticMarkup(createElement(SourceNotice,{source:'local',synthetic:true})),/generated history/);
 assert.match(renderToStaticMarkup(createElement(BuildIdentity)),/<details><summary>Demo &amp; technical tools<\/summary>/);
 for(const source of ['local','live'])assert.doesNotMatch(renderToStaticMarkup(createElement(SourceSelector,{value:source})),/value="demo"/);
 assert.match(renderToStaticMarkup(createElement(SourceSelector,{value:'demo'})),/Sample data · no model run/);
 const {default:EvidenceTabs}=await server.ssrLoadModule('/src/features/predictive/EvidenceTabs.jsx');
 const tabs=renderToStaticMarkup(createElement(EvidenceTabs,{sections:[{id:'one',title:'One',content:'First evidence'},{id:'two',title:'Two',content:'Lazy evidence'}]}));
 assert.match(tabs,/role="tablist"/);assert.equal((tabs.match(/aria-selected="true"/g)||[]).length,1);
 assert.match(tabs,/First evidence/);assert.doesNotMatch(tabs,/Lazy evidence/);
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
 const {default:KitchenDecisionJourney,KitchenWorkflowReview,MenuEvidence,DecisionReviewBoard}=await server.ssrLoadModule('/src/features/predictive/KitchenDecisionJourney.jsx');
 const selected={...risk,ingredient_id:'raw-material-1',raw_material_id:1,ingredient_name:'Fresh yellow noodles',
   signal:'review',shortfall_quantity:0,confirmed_requirement:0,eligible_stock:5400,forecast_waste_cost_myr:1.18,
   waste_sensitivity_low:0,waste_sensitivity_high:1078.495,alert_reason:'Generated history needs verification',
   explanation:'Confirmed-only stock is not the forecast result.',menus:[{product_id:1,product_name:menu.product_name,quantity_per_portion:100}]};
 const plan={as_of:'2026-10-17',window:{start_date:'2026-10-17',end_date:'2026-10-23',horizon_days:7},coverage:{excluded_orders:0},
   decision_support:{menus:[menu],ingredient_risks:[selected],alert_count:0,review_count:1,assumptions:[]}};
 const {default:KitchenEvidencePanel}=await server.ssrLoadModule('/src/features/predictive/KitchenEvidencePanel.jsx');
 const panelPlan={...plan,coverage:{included_orders:0,excluded_orders:3},excluded_orders:[{order_id:1,reason:'outside_horizon'},{order_id:2,reason:'not_paid'},{order_id:3,reason:'not_paid'}],warnings:['Same source note','Additional source note'],decision_support:{...plan.decision_support,assumptions:['Same source note'],synthetic_history_items:10}};
 const evidence=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(KitchenEvidencePanel,{plan:panelPlan,onToggle:()=>{}})));
 assert.match(evidence,/Evidence &amp; data checks · 3 excluded orders/);
 assert.match(evidence,/<strong>2<\/strong> Payment not confirmed/);
 assert.match(evidence,/Outside this planning window/);
 assert.match(evidence,/Individual excluded order references/);
 assert.match(evidence,/Order #3/);
 assert.doesNotMatch(evidence,/Same source note/);
 assert.match(evidence,/Forecast methods/);
 assert.match(evidence,/not probability ranges/);
 assert.match(evidence,/Generated history is included/);
 const board=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(DecisionReviewBoard)));
 assert.match(board,/<details><summary>Restore a saved decision file<\/summary>/);
 assert.match(board,/does not import sales, change inventory or train the model/);
 assert.match(board,/type="file" accept="application\/json,.json"/);
 assert.match(board,/not a shared decision log/);
 const journey=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/admin/ai/decisions?source=local&step=1']},
   createElement(KitchenDecisionJourney,{plan,comparison:null,onComparison:()=>{},onClear:()=>{}})));
 assert.ok(journey.indexOf('Where the forecast need comes from')<journey.indexOf('Exact expiry calculation'));
 assert.match(journey,/Supporting evidence/);
 assert.match(journey,/From expiring stock/);
 assert.match(journey,/From later stock/);
 assert.match(journey,/Demand assumptions/);
 assert.doesNotMatch(journey,/Central forecast · Step 1 result/);
 assert.doesNotMatch(journey,/Projected waste sensitivity:/);
 assert.doesNotMatch(journey,/Saved decisions &amp; follow-up/);
 const finalReview=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/admin/ai/decisions?source=local&step=4']},createElement(KitchenDecisionJourney,{plan,comparison:null,onComparison:()=>{},onClear:()=>{}})));
 assert.match(finalReview,/Saved decisions &amp; follow-up/);
 const reviewedRisk={...selected,forecast_shortfall:1234};
 const links={preparation:'/admin/planner',menus:'/admin/products',inventory:'/admin/inventory'};
 const renderReview=action=>renderToStaticMarkup(createElement(MemoryRouter,null,createElement(KitchenWorkflowReview,{action,risk:reviewedRisk,links})));
 const preparationReview=renderReview('menu');
 assert.match(preparationReview,/OUTCOME NOT SIMULATED/);
 assert.match(preparationReview,/1.234 kg/);
 assert.match(preparationReview,/Not simulated/);
 assert.match(preparationReview,/No new schedule, sales uplift, cost or benefit/);
 assert.doesNotMatch(preparationReview,/assumed action cost, with the same/);
 assert.match(renderReview('wait'),/Unchanged/);
 const menuWithAdjustments={...menu,demand_adjustments:{delivery_day_excluded:0,lead_time_excluded:2.32,capacity_excluded:0,recorded_orders_offset:0},sensitivity_error_portions_per_day:1.069};
 const menuEvidence=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(MenuEvidence,{support:{menus:[menuWithAdjustments,{...menuWithAdjustments,product_id:2,product_name:'Other menu'}]},compact:true})));
 assert.match(menuEvidence,/aria-label="Menu to inspect"/);
 assert.match(menuEvidence,/16.21 forecast portions · full window/);
 assert.match(menuEvidence,/13.89 additional portions eligible to plan/);
 assert.match(menuEvidence,/− 2.32 portions before the earliest permitted delivery/);
 assert.doesNotMatch(menuEvidence,/0 portions outside/);
 assert.doesNotMatch(menuEvidence,/<h3>Other menu<\/h3>/);
 assert.match(menuEvidence,/not a probability range/);
 for(const [step,action] of [[2,'menu'],[3,'menu'],[3,'wait'],[3,'purchasing']]) {
   const screen=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[`/admin/ai/decisions?source=local&step=${step}&action=${action}`]},createElement(KitchenDecisionJourney,{plan,comparison:null,onComparison:()=>{},onClear:()=>{}})));
   assert.match(screen,/Decision journey/);
   if(step===3 && action==='menu')assert.match(screen,/OUTCOME NOT SIMULATED/);
   if(step===3 && action==='purchasing')assert.match(screen,/Compare purchase/);
 }
 const {default:KitchenPurchaseComparison}=await server.ssrLoadModule('/src/features/predictive/KitchenPurchaseComparison.jsx');
 const comparedRisk={...selected,forecast_waste_cost_myr:2,potential_waste_cost_myr:2,expiring_unused_quantity:196.891};
 const comparison={purchase:{raw_material_id:1},baseline:{ingredient_risks:[comparedRisk],decision_support:{ingredient_risks:[comparedRisk]}},
   scenario:{ingredient_risks:[comparedRisk],decision_support:{ingredient_risks:[comparedRisk]}}};
 const purchase=renderToStaticMarkup(createElement(KitchenPurchaseComparison,{plan,risk:{...selected,forecast_waste_cost_myr:999,potential_waste_cost_myr:999},comparison,onComparison:()=>{},onClear:()=>{},onWorksheet:()=>{}}));
 assert.doesNotMatch(purchase,/999/);
 assert.match(purchase,/2\.00/);
 const {default:DecisionAssistant}=await server.ssrLoadModule('/src/features/predictive/DecisionAssistant.jsx');
 const {demoForecast}=await server.ssrLoadModule('/src/features/predictive/mockData.js');
 const external=demoForecast({center_id:13,week:146,promotion_scenario:false});
 for(let step=0;step<5;step++){
  const screen=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[`/admin/ai/decisions?source=demo&step=${step}`]},
    createElement(DecisionAssistant,{baseline:external,scenario:null,isFixture:true,onPromotion:()=>{}})));
  assert.match(screen,/Decision journey/);assert.match(screen,new RegExp(`STEP ${step+1} OF 5`));
  if(step===3){assert.match(screen,/OUTCOME NOT SIMULATED/);assert.doesNotMatch(screen,/Action comparison workspace/);}
 }
 const promoted=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/admin/ai/decisions?source=demo&step=3&action=promotion']},createElement(DecisionAssistant,{baseline:external,scenario:null,isFixture:true,onPromotion:()=>{}})));
 assert.match(promoted,/Action comparison workspace/);
 assert.match(promoted,/Calculate promotion what-if/);
 const covered={...external,ingredient_risks:external.ingredient_risks.map(risk=>risk.ingredient_id==='chicken'?{...risk,risk_type:'none',expiring_unused_kg:0,shortfall_kg:0}:risk)};
 const coveredScreen=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/admin/ai/decisions?source=demo&ingredient=chicken']},createElement(DecisionAssistant,{baseline:covered,scenario:external,isFixture:true,onPromotion:()=>{}})));
 assert.match(coveredScreen,/No baseline risk reported: chicken/);
 assert.doesNotMatch(coveredScreen,/undefined/);
 console.log('Stock flow: expiry waste, carried stock, total balance, unknown cost and zero-waste explanation passed.');
} finally {await server.close();}
