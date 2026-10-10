import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserProvider,ContractFactory,id,parseEther} from 'ethers';
import {artifact} from './compile.mjs';
// Ganache 7 has no native µWS binary for current Node releases. Select its
// supported JavaScript transport explicitly; this does not bypass EVM checks.
process.env.UWS_USE_FALLBACK='1';
const {default:ganache}=await import('ganache');
async function setup(chainId=31337){
 const rpc=ganache.provider({chain:{chainId},logging:{quiet:true}});
 // Ganache mines synchronously: cached estimates/block reads can describe the
 // state before the previous transaction. Keep this test provider uncached.
 const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1,pollingInterval:10});
 const [buyer,seller,arbiter,stranger]=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
 const factory=new ContractFactory(artifact.abi,artifact.evm.bytecode.object,buyer);
 return {rpc,provider,buyer,seller,arbiter,stranger,factory};
}
async function rejectsTransaction(send){
 // Submission can succeed even when execution reverts. Check the mined
 // receipt too, and do not accept transport errors as contract rejections.
 await assert.rejects(async()=>{const tx=await send();await tx.wait();},
  error=>error.code==='CALL_EXCEPTION');
}
test('escrow lifecycle, roles, deadlines and double withdrawal protection',async()=>{
 const x=await setup();
 try {
 const c=await x.factory.deploy();await c.waitForDeployment();
 const now=(await x.provider.getBlock('latest')).timestamp;
 const amount=parseEther('0.001');
 const fund=async(name,deadline=now+3600)=>{const key=id(name);await(await c.fund(key,x.seller.address,x.arbiter.address,deadline,{value:amount})).wait();return key;};
 const a=await fund('receipt');
 await rejectsTransaction(()=>c.fund(a,x.seller.address,x.arbiter.address,now+3600,{value:amount,gasLimit:500000}));
 await rejectsTransaction(()=>c.connect(x.stranger).dispatch(a));
 await rejectsTransaction(()=>c.refund(a));
 assert.equal((await c.deals(a)).state,1n);
 await(await c.connect(x.seller).dispatch(a)).wait();
 await rejectsTransaction(()=>c.connect(x.seller).confirmReceipt(a));
 await(await c.confirmReceipt(a)).wait();
 assert.equal((await c.deals(a)).state,4n);
 assert.equal(await c.credits(x.seller.address),amount);
 await rejectsTransaction(()=>c.confirmReceipt(a));
 await(await c.connect(x.seller).withdraw()).wait();
 assert.equal(await c.credits(x.seller.address),0n);
 await rejectsTransaction(()=>c.connect(x.seller).withdraw({gasLimit:100000}));
 const b=await fund('dispute');
 await(await c.connect(x.seller).dispatch(b)).wait();
 await(await c.dispute(b)).wait();
 await rejectsTransaction(()=>c.resolve(b,true));
 await(await c.connect(x.arbiter).resolve(b,true)).wait();
 assert.equal((await c.deals(b)).state,5n);
 const d=await fund('late');
 const e=await fund('silent-arbiter');
 await(await c.connect(x.seller).dispatch(e)).wait();
 await(await c.dispute(e)).wait();
 await x.rpc.request({method:'evm_increaseTime',params:[3601]});await x.rpc.request({method:'evm_mine',params:[]});
 await rejectsTransaction(()=>c.connect(x.seller).dispatch(d));
 await(await c.refund(d)).wait();
 await x.rpc.request({method:'evm_increaseTime',params:[7*86400]});await x.rpc.request({method:'evm_mine',params:[]});
 await rejectsTransaction(()=>c.connect(x.arbiter).resolve(e,false));
 await(await c.refund(e)).wait();
 assert.equal(await c.credits(x.buyer.address),amount*3n);
 await(await c.withdraw()).wait();
 assert.equal(await c.credits(x.buyer.address),0n);
 } finally {await x.rpc.disconnect();}
});
test('contract refuses mainnet deployment',async()=>{
 const x=await setup(1);try{await assert.rejects(async()=>{const c=await x.factory.deploy();await c.waitForDeployment();},error=>error.code==='CALL_EXCEPTION');}finally{await x.rpc.disconnect();}
});
test('funding rejects invalid participants, amounts and deadlines without holding coins',async()=>{
 const x=await setup();
 try {
  const c=await x.factory.deploy();await c.waitForDeployment();
  const now=(await x.provider.getBlock('latest')).timestamp;
  const zero='0x'+'0'.repeat(40),key=id('invalid');
  const cases=[
   [key,zero,x.arbiter.address,now+3600,parseEther('0.001')],
   [key,x.buyer.address,x.arbiter.address,now+3600,parseEther('0.001')],
   [key,x.seller.address,x.seller.address,now+3600,parseEther('0.001')],
   [key,x.seller.address,x.arbiter.address,now+3600,0n],
   [key,x.seller.address,x.arbiter.address,now+3600,parseEther('0.010001')],
   [key,x.seller.address,x.arbiter.address,now-1,parseEther('0.001')],
   [key,x.seller.address,x.arbiter.address,now+8*86400,parseEther('0.001')],
   ['0x'+'0'.repeat(64),x.seller.address,x.arbiter.address,now+3600,parseEther('0.001')],
  ];
  for(const [key,seller,arbiter,deadline,value] of cases) {
   await rejectsTransaction(()=>c.fund(key,seller,arbiter,deadline,{value}));
   assert.equal((await c.deals(key)).state,0n);
  }
  assert.equal(await x.provider.getBalance(await c.getAddress()),0n);
 } finally {await x.rpc.disconnect();}
});
test('seller refund and arbiter release credit the correct recipient exactly once',async()=>{
 const x=await setup();
 try {
  const c=await x.factory.deploy();await c.waitForDeployment();
  const now=(await x.provider.getBlock('latest')).timestamp,amount=parseEther('0.001');
  const a=id('seller-refund'),b=id('arbiter-release');
  for(const key of [a,b]) await(await c.fund(key,x.seller.address,x.arbiter.address,now+3600,{value:amount})).wait();
  await(await c.connect(x.seller).refund(a)).wait();
  assert.equal(await c.credits(x.buyer.address),amount);
  await rejectsTransaction(()=>c.connect(x.seller).refund(a));
  await(await c.connect(x.seller).dispatch(b)).wait();
  await(await c.dispute(b)).wait();
  await rejectsTransaction(()=>c.connect(x.stranger).resolve(b,false));
  await(await c.connect(x.arbiter).resolve(b,false)).wait();
  assert.equal(await c.credits(x.seller.address),amount);
  assert.equal((await c.deals(b)).state,4n);
  await rejectsTransaction(()=>c.connect(x.arbiter).resolve(b,false));
  await rejectsTransaction(()=>c.refund(b));
 } finally {await x.rpc.disconnect();}
});
