import test from 'node:test';
import assert from 'node:assert/strict';
import {menuPage,menuDetail,kitchenPromotion,shortDeliveryDays} from './menuPresentation.js';
const meal={id:1,name:'Nasi Lemak',price:'9.00',lead_hours:24,daily_capacity:20,delivery_weekdays:[0,2],description:'Rice and sides',image_url:'',selling_status:'active'};
const page={count:1,next:null,results:[meal]};
test('menu records preserve actual prices, preorder rules and genuine empty results',()=>{
 assert.equal(menuPage(page).rows[0],meal);assert.equal(menuPage({count:0,next:null,results:[]}).count,0);
 assert.equal(menuDetail({...meal,price:'0.00',lead_hours:0},'1').price,'0.00');
 assert.equal(shortDeliveryDays([0,2,6]),'Mon, Wed, Sun');assert.equal(shortDeliveryDays([]),'');
});
test('bad payloads remain read failures instead of empty menus or invented prices',()=>{
 for(const invalid of [null,{...page,results:null},{...page,count:0},{...page,next:false},
  {...page,results:[meal,meal],count:2},...['',null,'NaN',-1].map(price=>({...page,results:[{...meal,price}]})),
  {...page,results:[{...meal,delivery_weekdays:[8]}]}])assert.throws(()=>menuPage(invalid),e=>e.code==='INVALID_RESPONSE');
 for(const invalid of [{...meal,id:2},{...meal,description:null},{...meal,selling_status:'unknown'}])assert.throws(()=>menuDetail(invalid,1),e=>e.code==='INVALID_RESPONSE');
});
test('only configured nonzero group discounts become promotional copy',()=>{
 assert.deepEqual(kitchenPromotion({bulk_discount_percent:10,bulk_minimum:12}),{percent:10,minimum:12});
 for(const config of [{},{bulk_discount_percent:0,bulk_minimum:10},{bulk_discount_percent:101,bulk_minimum:10},{bulk_discount_percent:10,bulk_minimum:0}])assert.equal(kitchenPromotion(config),null);
});
