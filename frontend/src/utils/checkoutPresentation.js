import {responseList,invalidResponse} from './apiResponse.js';
import {accountDetails} from './customerExperience.js';

const positive=value=>Number.isSafeInteger(value) && value>0;
const money=value=>(typeof value==='number' || typeof value==='string') && /^\d+(?:\.\d{1,2})?$/.test(String(value));
export function basketRows(data){
 const rows=responseList(data);
 if(rows.some(row=>!positive(row.id) || !positive(row.quantity) || row.quantity>10000 || !positive(row.product?.id)
  || typeof row.product.name!=='string' || !row.product.name.trim() || !money(row.product.price)
  || !['active','paused','archived'].includes(row.product.selling_status))
  || new Set(rows.map(row=>row.id)).size!==rows.length)throw invalidResponse();
 basketTotals(rows,null);
 return rows;
}
export const pricingConfigured=store=>Number.isInteger(store?.bulk_discount_percent) && store.bulk_discount_percent>=0 && store.bulk_discount_percent<=100 && positive(store.bulk_minimum);
export function basketTotals(cart,store){
 const cents=value=>{if(!money(value))throw invalidResponse();const [whole,fraction='']=String(value).split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));};
 const subtotal=cart.reduce((sum,row)=>sum+cents(row.product.price)*BigInt(row.quantity),0n);
 const portions=cart.reduce((sum,row)=>sum+row.quantity,0);
 let discount=0n;
 if(pricingConfigured(store) && portions>=store.bulk_minimum){
  const numerator=subtotal*BigInt(store.bulk_discount_percent),whole=numerator/100n,remainder=numerator%100n;
  // Match Django Decimal.quantize's half-even rounding at half a cent.
  discount=whole+(remainder>50n || remainder===50n && whole%2n===1n?1n:0n);
 }
 const shipping=subtotal>=5000n?0n:500n;
 if(subtotal>BigInt(Number.MAX_SAFE_INTEGER))throw invalidResponse();
 return {total:Number(subtotal)/100,discount:Number(discount)/100,shipping:Number(shipping)/100,finalTotal:Number(subtotal-discount+shipping)/100};
}
export function checkoutAddress(data,allowEmpty=false){
 if(allowEmpty && (data===null || data===''))return null;
 if(!positive(data?.id))throw invalidResponse();
 return {id:data.id,...accountDetails(data,true)};
}
export function demoAddressId(routeId,read=()=>localStorage.getItem('addressId')){
 if(positive(routeId))return routeId;
 try{const value=Number(read());return positive(value)?value:null;}catch{return null;}
}
