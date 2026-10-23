import assert from 'node:assert/strict';
import {test} from 'node:test';
import {basketRows,basketTotals,pricingConfigured,checkoutAddress,demoAddressId} from './checkoutPresentation.js';
import {emptyAddress} from './customerExperience.js';
const row=(price='10.05',quantity=1)=>({id:1,quantity,product:{id:2,name:'Meal',price,selling_status:'active'}});
test('invalid baskets are read failures; genuine empty baskets and unavailable menu status are preserved',()=>{
 assert.deepEqual(basketRows([]),[]);assert.deepEqual(basketRows({results:[row()]}),[row()]);
 assert.equal(basketRows([{...row(),product:{...row().product,selling_status:'archived'}}])[0].product.selling_status,'archived');
 for(const data of [null,{},[{}],[row(),row()],[row('bad')],[row('-1')],[row('1.005')],[row('1',0)],[row('1',10001)],[{...row(),product:null}]])assert.throws(()=>basketRows(data),{code:'INVALID_RESPONSE'});
});
test('basket preview matches server half-even cents and the pre-discount free-delivery threshold',()=>{
 const offer={bulk_discount_percent:10,bulk_minimum:1};
 assert.deepEqual(basketTotals([row()],offer),{total:10.05,discount:1,shipping:5,finalTotal:14.05});
 assert.equal(basketTotals([row('10.15')],offer).discount,1.02);
 assert.equal(basketTotals([row('10.06')],offer).discount,1.01);
 assert.equal(basketTotals([row('10.04')],offer).discount,1);
 assert.deepEqual(basketTotals([row('25.00',2)],offer),{total:50,discount:5,shipping:0,finalTotal:45});
 assert.equal(basketTotals([row('49.99')],offer).shipping,5);
 assert.equal(basketTotals([row()],{...offer,bulk_minimum:2}).discount,0);
 assert.equal(basketTotals([row('0.00')],offer).discount,0);
 assert.equal(pricingConfigured({}),false);assert.equal(pricingConfigured(offer),true);
});
test('an address needs valid saved identity and fields; an empty read is distinct from an invalid save',()=>{
 assert.equal(checkoutAddress('',true),null);assert.equal(checkoutAddress(null,true),null);
 assert.deepEqual(checkoutAddress({id:7,...emptyAddress,user:2}),{id:7,...emptyAddress});
 for(const data of [null,'',{}, {...emptyAddress,id:0},{...emptyAddress,id:7,phone:null}])assert.throws(()=>checkoutAddress(data),{code:'INVALID_RESPONSE'});
});
test('collection has zero delivery cost; configurable delivery pricing matches subtotal thresholds',()=>{
 const store={bulk_discount_percent:10,bulk_minimum:1,delivery_fee_myr:'7.00',free_delivery_minimum_myr:'60.00'};
 assert.equal(basketTotals([row('12.00')],store,'pickup').finalTotal,10.8);
 assert.equal(basketTotals([row('12.00')],store,'pickup').shipping,0);
 assert.equal(basketTotals([row('59.99')],store).shipping,7);
 assert.equal(basketTotals([row('60.00')],store).shipping,0);
 assert.equal(basketTotals([row('60.00')],{...store,free_delivery_minimum_myr:null}).shipping,7);
 for(const change of [{delivery_fee_myr:'-1'},{free_delivery_minimum_myr:'bad'},{pickup_enabled:true,pickup_location:''},{delivery_open_hour:14,delivery_close_hour:7},{delivery_areas:'Moyan'}])assert.equal(pricingConfigured({...store,...change}),false);
});
test('demo payment navigation works without local storage and rejects invalid fallback IDs',()=>{
 const blocked=()=>{throw new Error('Storage blocked');};
 assert.equal(demoAddressId(4,blocked),4);assert.equal(demoAddressId(null,blocked),null);
 assert.equal(demoAddressId(null,()=> '12'),12);
 for(const value of ['0','-1','NaN','1.5',''])assert.equal(demoAddressId(null,()=>value),null);
});
