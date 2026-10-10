import test from 'node:test';
import assert from 'node:assert/strict';
import {escrowActions, escrowFunding, escrowError, waitForEscrowTransaction} from './escrowState.js';
const buyer='0x0000000000000000000000000000000000000001';
const seller='0x0000000000000000000000000000000000000002';
const arbiter='0x0000000000000000000000000000000000000003';
const deal={buyer,seller,arbiter,state:1n,dispatchBy:100n,resolveBy:200n};

test('roles and exact chain-time boundaries govern visible actions',()=>{
  assert.equal(escrowActions(deal,buyer,100).refund,false);
  assert.equal(escrowActions(deal,buyer,101).refund,true);
  assert.equal(escrowActions(deal,seller,100).dispatch,true);
  assert.equal(escrowActions(deal,seller,101).dispatch,false);
  for(const state of [2n,3n]) {
    assert.equal(escrowActions({...deal,state},buyer,200).refund,false);
    assert.equal(escrowActions({...deal,state},buyer,201).refund,true);
  }
  assert.equal(escrowActions({...deal,state:2n},seller,200).dispute,true);
  assert.equal(escrowActions({...deal,state:2n},seller,201).dispute,false);
  assert.equal(escrowActions({...deal,state:3n},arbiter,200).resolve,true);
  assert.equal(escrowActions({...deal,state:3n},arbiter,201).resolve,false);
  assert.equal(escrowActions(deal,arbiter,50).dispatch,false);
  assert.equal(escrowActions(deal,'0x0000000000000000000000000000000000000004',50).refund,false);
  assert.equal(escrowActions({...deal,state:4n},seller,50).refund,false);
  assert.equal(escrowActions(null,'',50).role,'Observer');
  assert.equal(escrowActions(deal,seller,null).dispatch,false);
});
test('funding checks distinct participants and test-coin bounds before a wallet request',()=>{
  assert.equal(escrowFunding(seller,arbiter,buyer,'0.001'),1000000000000000n);
  for(const amount of ['0','-1','NaN','Infinity','1e-3','0.010001']) assert.throws(()=>escrowFunding(seller,arbiter,buyer,amount));
  assert.throws(()=>escrowFunding(buyer,arbiter,buyer,'0.001'),/different wallets/);
  assert.throws(()=>escrowFunding('0x'+'0'.repeat(40),arbiter,buyer,'0.001'),/zero address/);
});
test('mined confirmation and successful speed-up use the final transaction hash',async()=>{
  const hashes=[];
  const receipt={status:1};
  assert.equal(await waitForEscrowTransaction({hash:'original',wait:async()=>receipt},hash=>hashes.push(hash)),receipt);
  const replacement={code:'TRANSACTION_REPLACED',cancelled:false,receipt,replacement:{hash:'new'}};
  assert.equal(await waitForEscrowTransaction({hash:'old',wait:async()=>{throw replacement;}},hash=>hashes.push(hash)),receipt);
  assert.deepEqual(hashes,['original','old','new']);
  for(const error of [{...replacement,cancelled:true},{...replacement,receipt:{status:0}},{code:'CALL_EXCEPTION'}]) {
    await assert.rejects(waitForEscrowTransaction({hash:'old',wait:async()=>{throw error;}},()=>{}),caught=>caught===error);
  }
});
test('wallet cancellation and unavailable test funds have actionable messages',()=>{
  assert.match(escrowError({code:4001}),/cancelled/);
  assert.match(escrowError({code:'INSUFFICIENT_FUNDS'}),/gas/);
  assert.match(escrowError({code:'CALL_EXCEPTION'}),/Refresh/);
});
