import assert from 'node:assert/strict';
import test from 'node:test';
import {escrowOrder} from './escrowOrder.js';
const data={order_id:1,payment_method:'escrow',payment_status:'unpaid',amount_myr:'30.00',can_create:true,config:{enabled:true,chain_id:11155111},invoice:null};
test('order escrow rejects mismatched orders, unsupported chains and invalid amount evidence',()=>{
 assert.equal(escrowOrder(data,1),data);
 for(const value of [{...data,order_id:2},{...data,payment_status:'confirmed'},{...data,config:{enabled:true,chain_id:1}},{...data,amount_myr:'NaN'}])assert.throws(()=>escrowOrder(value,1));
 const invoice={reference:'0x'+'1'.repeat(64),contract:'0x'+'1'.repeat(40),buyer:'0x'+'2'.repeat(40),seller:'0x'+'3'.repeat(40),arbiter:'0x'+'4'.repeat(40),chain_id:11155111,amount_wei:'1000000000000',dispatch_by:1800000000,confirmations:3,state:'awaiting_funding',funding_hash:null};
 assert.equal(escrowOrder({...data,invoice},1).invoice,invoice);
 for(const patch of [{confirmations:1},{amount_wei:'0'},{buyer:'invalid'},{funding_hash:'forged'}])assert.throws(()=>escrowOrder({...data,invoice:{...invoice,...patch}},1));
});
