import assert from 'node:assert/strict';
import {salesSummary,menuSales} from './salesResponse.js';

const summary={analytics:{net_food_sales:'0',average_order_value:'0',paid_orders:0,trend:[{date:'2026-10-05',sales:'0'}]},forecast:{method:'Insufficient history',next_7_days_portions:null,validation_mae:null}};
assert.equal(salesSummary(summary),summary);
assert.deepEqual(menuSales([]),[]);
assert.doesNotThrow(()=>menuSales([{product__id:null,product_name:'Earlier menu',total_quantity:2,total_revenue:'12.50'}]));
for(const bad of [null,{},'<html>Unavailable</html>',{...summary,analytics:{}},{...summary,forecast:{}},{...summary,analytics:{...summary.analytics,trend:[null]}}])assert.throws(()=>salesSummary(bad),{code:'INVALID_RESPONSE'});
for(const bad of [null,'',true,'NaN',Infinity,-1])assert.throws(()=>salesSummary({...summary,analytics:{...summary.analytics,net_food_sales:bad}}),{code:'INVALID_RESPONSE'});
for(const bad of [null,{},[null],[{product_name:'Meal',total_quantity:1,total_revenue:null}],[{product_name:'Meal',total_quantity:1.5,total_revenue:12}]])assert.throws(()=>menuSales(bad),{code:'INVALID_RESPONSE'});
assert.doesNotThrow(()=>salesSummary({...summary,forecast:{method:'Forecast',next_7_days_portions:0,validation_mae:0}}));
console.log('Sales response checks passed: recorded zero, unknown forecast, malformed and missing values.');
