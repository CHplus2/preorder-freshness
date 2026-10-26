import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unitLabel,quantityLabel,validSellingDetails,servingLabel} from './sellingDetails.js';
import {packingList} from './packing.js';

test('selling quantities use explicit units without converting to pieces or people',()=>{
 assert.equal(quantityLabel({unit:'box',serves_min:3,serves_max:4},2),'2 boxes');
 assert.equal(quantityLabel({unit:'box'},1),'1 box');
 assert.equal(quantityLabel({},2),'2 items');
 assert.equal(unitLabel({unit:'pack'},2),'packs');
 assert.equal(servingLabel({serves_min:4,serves_max:7}),'Serves 4–7 (estimate)');
 assert.equal(servingLabel({serves_min:4,serves_max:4}),'Serves 4 (estimate)');
 assert.equal(servingLabel({}),'');
});
test('optional legacy data is accepted while malformed offer documents are rejected',()=>{
 for(const value of [undefined,{}, {size_label:'🍱'.repeat(60),contents:'🍱'.repeat(500)}, {unit:'jar'}, {unit:'box',contents:'Fixed selection',no_substitutions:true}])assert.equal(validSellingDetails(value),true);
 for(const value of [null,[],{unit:'pallet'},{serves_min:4},{serves_min:7,serves_max:4},{no_substitutions:true},{unknown:4},{contents:'x'.repeat(501)}])assert.equal(validSellingDetails(value),false);
});
test('packing never combines different accepted selling units, sizes or fixed contents',()=>{
 const item={id:1,product:5,product_name:'Gift box',quantity:2,selling_details:{unit:'box',contents:'Original selection'}};
 const base={id:1,status:'pending',delivery_at:'2030-01-09T12:00:00+08:00',preparation_at:'2030-01-09T10:00:00+08:00',preparation_end_at:'2030-01-09T11:00:00+08:00',items:[item]};
 const list=packingList([base,{...base,id:2,items:[{...item,id:2,selling_details:{unit:'box',contents:'New selection'}}]}],'2030-01-09');
 assert.equal(list.menus.length,2);assert.equal(list.portions,4);
 assert.ok(list.menus.every(menu=>menu.quantity===2));
});

test('shipping enquiry requires a bounded dispatch window without changing legacy units',()=>{
 const offer={ordering_mode:'shipping_enquiry',dispatch_from:'2030-12-01',dispatch_through:'2030-12-31',shipping_note:'Courier agreed separately'};
 assert.equal(validSellingDetails(offer),true);
 for(const edit of [{dispatch_from:null},{dispatch_through:'2030-01-01'},{dispatch_through:'2032-12-01'},{ordering_mode:'courier_checkout'},{shipping_note:'x'.repeat(301)}])assert.equal(validSellingDetails({...offer,...edit}),false);
 assert.equal(quantityLabel({...offer,unit:'box'},2),'2 boxes');
});
