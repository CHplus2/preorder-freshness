import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountDetails,emptyAddress,customerOrderGroups,customerDelivery} from './customerExperience.js';

test('missing address is legitimate only on initial read; malformed responses cannot become blank forms or save confirmations',()=>{
  assert.deepEqual(accountDetails(null,true,true),emptyAddress);
  assert.deepEqual(accountDetails('',true,true),emptyAddress);
  for(const value of [null,'',[],{},'<html>failure</html>']) {
    assert.throws(()=>accountDetails(value),{code:'INVALID_RESPONSE'});
    assert.throws(()=>accountDetails(value,true),{code:'INVALID_RESPONSE'});
  }
  const profile={username:'buyer',first_name:'A',last_name:'B',is_staff:true};
  assert.deepEqual(accountDetails(profile),{username:'buyer',first_name:'A',last_name:'B'});
  assert.deepEqual(accountDetails({...emptyAddress,id:1,user:2},true),emptyAddress);
  assert.throws(()=>accountDetails({...emptyAddress,phone:null},true),{code:'INVALID_RESPONSE'});
});
test('only completed and cancelled orders move to history, without mutating provider records',()=>{
  const orders=[{id:1,status:'pending'},{id:3,status:'delivered'},{id:5,status:'cancelled'},{id:2,status:'shipped'},{id:4,status:'unknown'}];
  const groups=customerOrderGroups(orders);
  assert.deepEqual(groups.current.map(o=>o.id),[4,2,1]);
  assert.deepEqual(groups.history.map(o=>o.id),[5,3]);
  assert.deepEqual(groups.all.map(o=>o.id),[5,4,3,2,1]);
  assert.equal(orders[0].id,1);
  assert.deepEqual(customerOrderGroups([]),{current:[],history:[],all:[]});
});
test('delivery display uses Malaysia time without seconds and does not render invalid or epoch dates',()=>{
  assert.match(customerDelivery('2026-10-21T16:00:00Z'),/22 Oct 2026.*12:00.*Malaysia/i);
  for(const value of [null,undefined,'','invalid'])assert.equal(customerDelivery(value),'Contact the kitchen to arrange');
});
