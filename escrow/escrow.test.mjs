import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,id,parseEther} from 'ethers';
import {artifact} from './compile.mjs';
async function setup(chainId=31337){
 const rpc=ganache.provider({chain:{chainId},logging:{quiet:true}});
 const provider=new BrowserProvider(rpc);
 const [buyer,seller,arbiter,stranger]=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
 const factory=new ContractFactory(artifact.abi,artifact.evm.bytecode.object,buyer);
 return {rpc,provider,buyer,seller,arbiter,stranger,factory};
}
test('escrow lifecycle, roles, deadlines and double withdrawal protection',async()=>{
 const x=await setup();
 try {
 const c=await x.factory.deploy();await c.waitForDeployment();
 const now=(await x.provider.getBlock('latest')).timestamp;
 const amount=parseEther('0.001');
 const fund=async(name,deadline=now+3600)=>{const key=id(name);await(await c.fund(key,x.seller.address,x.arbiter.address,deadline,{value:amount})).wait();return key;};
 const a=await fund('receipt');
 await assert.rejects(c.fund(a,x.seller.address,x.arbiter.address,now+3600,{value:amount}));
 await assert.rejects(c.connect(x.stranger).dispatch(a));
 await assert.rejects(c.refund(a));
 await(await c.connect(x.seller).dispatch(a)).wait();
 await assert.rejects(c.connect(x.seller).confirmReceipt(a));
 await(await c.confirmReceipt(a)).wait();
 assert.equal((await c.deals(a)).state,4n);
 assert.equal(await c.credits(x.seller.address),amount);
 await assert.rejects(c.confirmReceipt(a));
 await(await c.connect(x.seller).withdraw()).wait();
 assert.equal(await c.credits(x.seller.address),0n);
 await assert.rejects(c.connect(x.seller).withdraw.staticCall());
 const b=await fund('dispute');
 await(await c.connect(x.seller).dispatch(b)).wait();
 await(await c.dispute(b)).wait();
 await assert.rejects(c.resolve(b,true));
 await(await c.connect(x.arbiter).resolve(b,true)).wait();
 assert.equal((await c.deals(b)).state,5n);
 const d=await fund('late');
 const e=await fund('silent-arbiter');
 await(await c.connect(x.seller).dispatch(e)).wait();
 await(await c.dispute(e)).wait();
 await x.rpc.request({method:'evm_increaseTime',params:[3601]});await x.rpc.request({method:'evm_mine',params:[]});
 await assert.rejects(c.connect(x.seller).dispatch(d));
 await(await c.refund(d)).wait();
 await x.rpc.request({method:'evm_increaseTime',params:[7*86400]});await x.rpc.request({method:'evm_mine',params:[]});
 await assert.rejects(c.connect(x.arbiter).resolve(e,false));
 await(await c.refund(e)).wait();
 assert.equal(await c.credits(x.buyer.address),amount*3n);
 await(await c.withdraw()).wait();
 assert.equal(await c.credits(x.buyer.address),0n);
 } finally {await x.rpc.disconnect();}
});
test('contract refuses mainnet deployment',async()=>{
 const x=await setup(1);try{await assert.rejects(x.factory.deploy());}finally{await x.rpc.disconnect();}
});
