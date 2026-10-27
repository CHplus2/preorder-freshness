import assert from 'node:assert/strict';
import {test} from 'node:test';
import {publicNavigation,kitchenNavigation,isCurrentSection,pageMetadata} from './siteNavigation.js';
import {customerAccounts} from './customerAccounts.js';
test('section selection keeps meal details in Menu and all FreshCast pages in FreshCast',()=>{
 for(const path of ['/menu','/products/24'])assert.equal(isCurrentSection(path,'/menu'),true);
 for(const path of ['/admin/ai/forecast','/admin/ai/inventory','/admin/ai/decisions']){
  assert.equal(isCurrentSection(path,'/admin/ai/decisions'),true);
  assert.equal(kitchenNavigation.filter(([url])=>isCurrentSection(path,url)).length,1);
 }
 assert.equal(isCurrentSection('/products/24/reviews','/menu'),false);
 assert.equal(isCurrentSection('/admin/ai/unknown','/admin/ai/decisions'),false);
 assert.equal(isCurrentSection('/story','/'),false);
});
test('every navigation destination has its own title; unknown routes do not inherit the previous page',()=>{
 for(const [path] of [...publicNavigation,...kitchenNavigation])assert.notEqual(pageMetadata(path).title,'Page not found');
 assert.equal(pageMetadata('/checkout').title,'Checkout');assert.equal(pageMetadata('/orders').title,'My orders');assert.equal(pageMetadata('/payment/paypal').title,'PayPal payment');
 assert.equal(pageMetadata('/confirm-email').title,'Confirm email change');
 assert.equal(pageMetadata('/products/24').title,'Menu details');assert.equal(pageMetadata('/missing').title,'Page not found');
});
test('customer account reads distinguish valid empty lists from invalid or duplicate identities',()=>{
 const account={id:2,username:'Local buyer',is_active:true,is_staff:false};
 assert.deepEqual(customerAccounts([]),[]);assert.deepEqual(customerAccounts({results:[account]}),[account]);
 for(const data of [null,{},[null],[{}],[account,account],[{...account,id:0}],[{...account,is_active:'true'}],[{...account,username:''}]])assert.throws(()=>customerAccounts(data),{code:'INVALID_RESPONSE'});
});
