import test from 'node:test';
import assert from 'node:assert/strict';
import {marketingWorksheet,workflowLinks,workflowReturnLink,decisionSlip,kitchenReadiness,riskTiming} from './kitchenDecision.js';
import {readReviews,saveReview,saveOutcomeNote} from './kitchenReviewStore.js';
import {stockQuantity,stockStory,kitchenCase,caseQuantity} from './kitchenPresentation.js';
import {decisionSteps,selectedDecisionStep,stockViewSelection,shoppingContextRows,genpactCarriedStock} from './decisionNavigation.js';

test('both sources share the same five steps and reject unsupported step values',()=>{
  assert.equal(decisionSteps.length,5);
  for(const value of ['-1','5','x','1.5'])assert.equal(selectedDecisionStep(value),0);
  assert.equal(selectedDecisionStep('4'),4);
});

test('fridge filters include forecast gaps, restore ingredient context and leave empty filters empty',()=>{
  const risks=[{ingredient_id:'raw-material-1',forecast_shortfall:100,shortfall_quantity:0,forecast_expiring_unused:0},
    {ingredient_id:'raw-material-2',forecast_shortfall:0,shortfall_quantity:0,forecast_expiring_unused:200}];
  const params=new URLSearchParams('ingredient=raw-material-2');
  assert.equal(stockViewSelection(risks,params).selected.ingredient_id,'raw-material-2');
  params.set('stock_filter','shortage');
  assert.equal(stockViewSelection(risks,params).selected.ingredient_id,'raw-material-1');
  params.set('stock_filter','waste');
  assert.equal(stockViewSelection(risks.slice(0,1),params).rows.length,0);
  assert.equal(stockViewSelection(risks.slice(0,1),params).selected,undefined);
});

test('shopping handoff focuses only the ingredient, without inventing forecast purchase rows',()=>{
  const rows=[{material_id:1,quantity:'10'},{material_id:2,quantity:'20'}];
  const params=new URLSearchParams('from=freshcast&material=2');
  assert.deepEqual(shoppingContextRows(rows,params),[rows[1]]);
  assert.equal(shoppingContextRows(rows,params,true),rows);
  assert.equal(shoppingContextRows(rows,new URLSearchParams('material=2')),rows);
  assert.equal(rows.length,2);
});

test('Genpact carried stock uses eligible later batches, and missing evidence stays unknown',()=>{
  const risk={ingredient_id:'rice',available_kg:100};
  assert.equal(genpactCarriedStock({week:146,batch_allocations:[]},risk),null);
  const data={week:146,batch_allocations:[
    {ingredient_id:'rice',eligible:true,expiry_week:146,remaining_kg:10},
    {ingredient_id:'rice',eligible:true,expiry_week:147,remaining_kg:20},
    {ingredient_id:'rice',eligible:false,expiry_week:148,remaining_kg:100}]};
  assert.equal(genpactCarriedStock(data,risk),20);
});

test('chicken shortage story separates expiring supply, later supply and uncovered demand',()=>{
  const risk={unit:'g',forecast_requirement:21841.927,forecast_shortfall:16081.927,shortfall_quantity:0,forecast_expiring_unused:0,
    stock_flow:{after_confirmed:5760,forecast_consumed:5760,projected_carried_stock:0,
      demand_by_day:[{date:'2026-10-18',forecast_requirement:3813.52,forecast_consumed:3813.52},{date:'2026-10-19',forecast_requirement:3799.218,forecast_consumed:1946.48}],
      batches:[{expires_in_window:true,expiry_date:'2026-10-19',after_confirmed:1800,forecast_consumed:1800},
        {expires_in_window:false,after_confirmed:3960,forecast_consumed:3960}]}};
  const story=stockStory(risk);
  assert.equal(story.nearAvailable,1800);assert.equal(story.nearUsed,1800);
  assert.equal(story.laterAvailable,3960);assert.equal(story.laterUsed,3960);
  assert.equal(story.afterNear,20041.927);
  assert.equal(story.need-story.nearUsed-story.laterUsed,story.gap);
  assert.equal(story.firstGap,'2026-10-19');
  assert.equal(kitchenCase(risk).kind,'shortage');
  assert.equal(caseQuantity(risk),'16.082 kg forecast gap');
  assert.equal(kitchenCase({...risk,forecast_expiring_unused:100}).kind,'mixed');
  assert.equal(kitchenCase({...risk,forecast_shortfall:0,forecast_expiring_unused:100}).kind,'waste');
  assert.equal(stockQuantity(196.891,'g'),'196.891 g');
  assert.equal(stockQuantity(null,'g'),'Unavailable');
});

test('available but expired-before-demand stock is not presented as forecast coverage',()=>{
  const risk={forecast_requirement:1000,forecast_shortfall:800,forecast_expiring_unused:200,
    stock_flow:{after_confirmed:400,forecast_consumed:200,projected_carried_stock:0,
      batches:[{expires_in_window:true,expiry_date:'2026-10-18',after_confirmed:200,forecast_consumed:0},
        {expires_in_window:false,after_confirmed:200,forecast_consumed:200}]}};
  const story=stockStory(risk);
  assert.equal(story.nearAvailable,200);assert.equal(story.nearUsed,0);
  assert.equal(story.afterNear,1000);assert.equal(story.gap,800);
});

test('workflow links carry real ingredient context and preserve native units',()=>{
  const risk={raw_material_id:7,ingredient_name:'Oil & sauce',unit:'ml'};
  const links=workflowLinks(risk,{window:{end_date:'2026-10-22'}});
  assert.equal(new URL('https://test'+links.inventory).searchParams.get('material'),'7');
  assert.equal(new URL('https://test'+links.planner).searchParams.get('ingredient'),'Oil & sauce');
  assert.equal(new URL('https://test'+links.planner).searchParams.get('view'),'shopping');
  assert.equal(links.marketing,'/admin/settings#promotions');
});
test('inventory and planner round-trip the selected horizon and use the review deadline',()=>{
  const links=workflowLinks({raw_material_id:7,ingredient_name:'Oil',urgent_by:'2026-10-19'}, {window:{end_date:'2026-10-30',horizon_days:14}});
  const planner=new URL('https://test'+links.planner);
  assert.equal(planner.searchParams.get('date'),'2026-10-19');
  const back=new URL('https://test'+workflowReturnLink(planner.searchParams));
  assert.equal(back.searchParams.get('horizon'),'14');
  assert.equal(back.searchParams.get('ingredient'),'raw-material-7');
  assert.equal(back.searchParams.get('step'),'4');
  planner.searchParams.set('horizon','999');
  assert.equal(new URL('https://test'+workflowReturnLink(planner.searchParams)).searchParams.has('horizon'),false);
});

test('marketing scenario caps ingredient benefit and keeps unknown costs unknown',()=>{
  const input={portions:'10',discount:'20',cost:'5',menu:{price_myr:10,variable_cost_myr:4},
    recipe:{quantity_per_portion:30},risk:{forecast_expiring_unused:100}};
  const result=marketingWorksheet(input);
  assert.equal(result.ingredientUsed,100);
  assert.equal(result.remaining,0);
  assert.equal(result.contribution,35);
  assert.equal(result.revenue,80);
  assert.equal(result.breakEven,2);
  assert.equal(marketingWorksheet({...input,menu:{...input.menu,variable_cost_myr:null}}).contribution,null);
  assert.equal(marketingWorksheet({...input,discount:'101'}),null);
  assert.equal(marketingWorksheet({...input,portions:''}),null);
  assert.equal(marketingWorksheet({...input,cost:'-1'}),null);
});

function storage(){let data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('zero exposure has no invented deadline while forecast-only shortages require evidence review',()=>{
  const zero={shortfall_quantity:0,forecast_shortfall:0,forecast_expiring_unused:0,signal:'watch',urgent_by:null};
  assert.match(riskTiming(zero,'2026-10-23'),/No stock gap or projected unused/);
  assert.doesNotMatch(riskTiming(zero,'2026-10-23'),/2026-10-23|Act before/);
  assert.match(riskTiming({...zero,forecast_shortfall:10,signal:'review'},'2026-10-23'),/Review evidence by 2026-10-23/);
  assert.match(riskTiming({...zero,shortfall_quantity:5,signal:'confirmed_shortage',urgent_by:'2026-10-18'},'2026-10-23'),/Review action by 2026-10-18/);
});
test('signed snapshots deduplicate retries and outcome notes never mutate signed baseline',()=>{
  const store=storage(),record={token:'signed',snapshot:{id:'one',baseline:{forecast_expiring_unused:20}}};
  saveReview(record,store);saveReview(record,store);
  assert.equal(readReviews(store).rows.length,1);
  saveOutcomeNote('one','Reviewed recorded waste',store);
  const saved=readReviews(store).rows[0];
  assert.equal(saved.token,'signed');assert.deepEqual(saved.snapshot,record.snapshot);
  assert.equal(saved.outcome_note,'Reviewed recorded waste');
  assert.equal(readReviews({getItem(){throw Error('blocked');}}).rows.length,0);
  assert.throws(()=>saveReview(record,{getItem:()=>null,setItem(){throw Error('quota');}}),/could not save/);
});

test('decision export preserves provenance, selected action and signed evidence',()=>{
  const text=decisionSlip({plan:{as_of:'2026-10-16',window:{horizon_days:7},decision_support:{menus:[],assumptions:['Not causal']}},
    risk:{ingredient_name:'Rice',unit:'g',menus:[]},action:'wait',reviewed:[],note:'Check records',worksheet:null,signedReview:{token:'signature'}});
  const parsed=JSON.parse(text);assert.equal(parsed.source,'LOCAL_KITCHEN');assert.equal(parsed.signed_review.token,'signature');
  assert.equal(parsed.baseline.unit,'g');assert.match(parsed.definition,/not realised/);
});

test("forecast readiness keeps zero estimates distinct from absent history and does not use upcoming booking count", () => {
  assert.equal(kitchenReadiness({menus:[{forecast_portions:12,confidence:'evaluated',recipe_complete:true,synthetic_history_items:70}]}).evaluated,0);
  const support = {
    menus: [
      { forecast_portions: 0, confidence: "limited", recipe_complete: true },
      {
        forecast_portions: null,
        confidence: "unavailable",
        recipe_complete: false,
      },
      { forecast_portions: 12, confidence: "evaluated", recipe_complete: true },
    ],
  };
  assert.deepEqual(kitchenReadiness(support), {
    menus: 3,
    forecasted: 2,
    evaluated: 1,
    missingRecipes: 1,
  });
  assert.equal(support.menus[0].forecast_portions, 0);
  assert.deepEqual(kitchenReadiness({ menus: [] }), {
    menus: 0,
    forecasted: 0,
    evaluated: 0,
    missingRecipes: 0,
  });
});
