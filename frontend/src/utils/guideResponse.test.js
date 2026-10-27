import assert from 'node:assert/strict';
import {guideResponse, rememberSuggestion} from './guideResponse.js';
import {moneyCents,budgetBadge,budgetSummary,budgetCatalogueMessage} from './guideBudget.js';
const row={id:1,name:'Rice',portions:2,food_total:'24.00',reasons:['Within budget'],slots:[{delivery_at:'2026-10-10T15:00:00+08:00'}]};
const response={session:'test-session',message:'Suggestions only',results:[row]};
assert.equal(guideResponse(response),response);
assert.deepEqual(guideResponse({...response,results:[]}).results,[]);
for(const bad of [null,{}, {...response,results:null}, {...response,empty_reason:'invented'}, ...[
  {food_total:null},{food_total:''},{food_total:'invalid'},{portions:0},{reasons:[null]},
  {slots:[]},{slots:[{delivery_at:'invalid'}]}
].map(change=>({...response,results:[{...row,...change}]}))]) {
  assert.throws(()=>guideResponse(bad),error=>error.code==='INVALID_RESPONSE');
}
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('Storage blocked');}});
assert.doesNotThrow(()=>rememberSuggestion('preferredDelivery','date'));
delete globalThis.sessionStorage;
const request={portions:3,budget:'100.00',budget_mode:'within'};
const expensive={...row,price:'35.00',portions:3,food_total:'105.00',budget_relation:'above',budget_difference:'5.00'};
assert.throws(()=>guideResponse({...response,results:[expensive]},request));
assert.equal(guideResponse({...response,results:[expensive]},{...request,budget_mode:'above'}).results[0],expensive);
assert.equal(guideResponse({...response,results:[expensive]},{...request,budget_mode:'all'}).results[0],expensive);
for(const bad of [{food_total:'35.00'},{portions:1},{budget_relation:'within'},{budget_difference:'4.00'},{price:undefined}])assert.throws(()=>guideResponse({...response,results:[{...expensive,...bad}]},{...request,budget_mode:'above'}));
const exact={...row,portions:3,price:'33.33',food_total:'99.99',budget_relation:'within',budget_difference:'0.00'};
assert.equal(guideResponse({...response,results:[exact]},{...request,budget:'99.99'}).results[0],exact);
assert.throws(()=>guideResponse({...response,results:[exact]},{...request,budget:'99.99',budget_mode:'above'}));
assert.throws(()=>guideResponse({...response,budget:{amount:'100.00',mode:'within',basis:'invented'},results:[exact]},request));
assert.equal(moneyCents('33.33')*3,9999);assert.equal(moneyCents('0.01'),1);
assert.equal(moneyCents('1e2'),10000);assert.equal(moneyCents('1e-2'),1);
for(const invalid of [true,null,'-1','NaN','1.001','999999999999999999'])assert.equal(moneyCents(invalid),null);
const format=value=>'RM '+Number(value).toFixed(2);
assert.equal(budgetBadge(expensive,'100.00',format),'RM 5.00 above your budget');
assert.equal(budgetBadge(exact,'99.99',format),'Exactly on your budget');
assert.equal(budgetSummary('all','100.00',format),'within and above RM 100.00 food total');
const catalogue={scope:'date_category_recipes_before_capacity',quantity:3,menu_count:5,within_count:5,above_count:0,minimum_food_total:'30.00',maximum_food_total:'42.00'};
assert.equal(guideResponse({...response,results:[],budget_catalogue:catalogue},request).budget_catalogue,catalogue);
assert.match(budgetCatalogueMessage(catalogue,'100',format),/3 units of one menu/);
assert.match(budgetCatalogueMessage(catalogue,'100',format),/None is above RM 100.00/);
assert.match(budgetCatalogueMessage(catalogue,'100',format),/before kitchen availability checks/);
assert.match(budgetCatalogueMessage({...catalogue,within_count:4,above_count:1,maximum_food_total:'105.00'},'100',format),/4 within RM 100.00; 1 above/);
for(const changes of [{quantity:2},{menu_count:4},{above_count:1},{minimum_food_total:'200.00'},{maximum_food_total:'105.00'},{scope:'invented'},{menu_count:0,within_count:0,above_count:0}])assert.throws(()=>guideResponse({...response,results:[],budget_catalogue:{...catalogue,...changes}},request));
assert.throws(()=>guideResponse({...response,results:[expensive],budget_catalogue:catalogue},{...request,budget_mode:'all'}));
console.log('Guide response validation and optional storage recovery passed.');
