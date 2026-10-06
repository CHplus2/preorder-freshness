import assert from 'node:assert/strict';
import {costReport,contributionReport,pricingResponse,costMaterials,costLots,costExpenses} from './costResponse.js';
const period={start:'2026-10-01',end:'2026-10-06'};
const menu={id:1,name:'Rice',price:'10',missing:[],ingredient_cost:'12',packaging_cost:'0',estimated_contribution:'-2',estimated_margin_percent:'-20'};
const costs={...period,operating_expenses:'0',known_waste_cost:'0',unpriced_waste_records:0,menus:[menu],waste:[]};
assert.equal(costReport(costs),costs);
assert.equal(costReport({...costs,menus:[{...menu,missing:['Unknown'],ingredient_cost:null,estimated_contribution:null,estimated_margin_percent:null}]}).menus[0].ingredient_cost,null);
for(const changes of [{menus:null},{waste:{}},{operating_expenses:null},{known_waste_cost:'bad'},{menus:[{...menu,missing:null}]},{menus:[{...menu,price:''}]}])assert.throws(()=>costReport({...costs,...changes}),e=>e.code==='INVALID_RESPONSE');
const row={order:1,status:'delivered',realised:true,missing:[],net_food_revenue:'10',known_ingredient_cost:'12',accepted_packaging_cost:'0',food_contribution:'-2',trace:[]};
const contribution={...period,definition:'Definition',known_contribution:'-2',complete_orders:1,shown:1,order_count:1,rows:[row]};
assert.equal(contributionReport(contribution),contribution);
assert.equal(contributionReport({...contribution,rows:[{...row,food_contribution:null}]}).rows[0].food_contribution,null);
for(const changes of [{rows:null},{shown:2},{known_contribution:null},{rows:[{...row,trace:null}]},{rows:[{...row,food_contribution:'NaN'}]},{rows:[{...row,trace:[{}]}]}])assert.throws(()=>contributionReport({...contribution,...changes}),e=>e.code==='INVALID_RESPONSE');
console.log('Cost/contribution checks preserve zero, unknown and negative values; reject malformed records.');
const scenario={price:'1',discount_percent:'0',food_revenue:'10',additional_cost:'0',ingredient_cost:'12',packaging_cost:'1',contribution:'-3',margin_percent:'-30',per_portion:'-0.3',break_even_price:'1.3',below_cost:true};
const pricing={menu:'Rice',definition:'Estimate',portions:10,current_bulk_minimum:20,missing:[],contribution_change:'-10',assumptions:{ingredient_increase_percent:'0',additional_cost_per_portion:'0'},baseline:scenario,proposed:scenario};
assert.equal(pricingResponse(pricing),pricing);
assert.equal(pricingResponse({...pricing,missing:['Cost missing'],contribution_change:null,proposed:{...scenario,contribution:null,margin_percent:null,per_portion:null,break_even_price:null,below_cost:null}}).proposed.contribution,null);
for(const changes of [{assumptions:null},{proposed:null},{proposed:{...scenario,food_revenue:''}},{baseline:{...scenario,below_cost:'false'}},{proposed:{...scenario,contribution:'NaN'}}])assert.throws(()=>pricingResponse({...pricing,...changes}),e=>e.code==='INVALID_RESPONSE');
for(const [validate,row] of [
 [costMaterials,{id:1,name:'Rice',unit:'g',estimated_unit_cost:null}],
 [costLots,{id:1,raw_material_name:'Rice',unit:'g',batch_code:'',quantity:'0'}],
 [costExpenses,{id:1,date:'2026-10-06',amount:'0',category:'utilities',note:'Test',voided:false}]
]){assert.deepEqual(validate([row]),[row]);assert.throws(()=>validate([{}]),e=>e.code==='INVALID_RESPONSE');assert.throws(()=>validate([{...row,id:0}]),e=>e.code==='INVALID_RESPONSE');}
console.log('Pricing and supporting cost records validated, including unknown costs and losses.');
