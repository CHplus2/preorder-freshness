import test from 'node:test';
import assert from 'node:assert/strict';
import {marketingWorksheet,workflowLinks,decisionSlip} from './kitchenDecision.js';
import {readReviews,saveReview,saveOutcomeNote} from './kitchenReviewStore.js';

test('workflow links carry real ingredient context and preserve native units',()=>{
  const risk={raw_material_id:7,ingredient_name:'Oil & sauce',unit:'ml'};
  const links=workflowLinks(risk,{window:{end_date:'2026-10-22'}});
  assert.equal(new URL('https://test'+links.inventory).searchParams.get('material'),'7');
  assert.equal(new URL('https://test'+links.planner).searchParams.get('ingredient'),'Oil & sauce');
  assert.equal(new URL('https://test'+links.planner).searchParams.get('view'),'shopping');
  assert.equal(links.marketing,'/admin/settings#promotions');
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
