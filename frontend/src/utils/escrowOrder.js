import {isAddress} from 'ethers';
import {invalidResponse} from './apiResponse.js';
const hash=value=>typeof value==='string' && /^0x[0-9a-f]{64}$/i.test(value);
export function escrowOrder(data,id){
 if(!data || data.order_id!==id || data.payment_method!=='escrow' || !['unpaid','paid','refunded'].includes(data.payment_status)
  || typeof data.amount_myr!=='string' || !/^\d+\.\d{2}$/.test(data.amount_myr) || typeof data.can_create!=='boolean'
  || data.config?.chain_id!==11155111 || typeof data.config.enabled!=='boolean')throw invalidResponse();
 const i=data.invoice;
 if(i && (!hash(i.reference) || ![i.contract,i.buyer,i.seller,i.arbiter].every(isAddress) || i.chain_id!==11155111
  || typeof i.amount_wei!=='string' || !/^\d+$/.test(i.amount_wei) || BigInt(i.amount_wei)<=0n || BigInt(i.amount_wei)>10n**16n
  || !Number.isSafeInteger(i.dispatch_by) || !Number.isInteger(i.confirmations) || i.confirmations<2 || i.confirmations>64
  || typeof i.state!=='string' || (i.funding_hash!==null && !hash(i.funding_hash))))throw invalidResponse();
 return data;
}
