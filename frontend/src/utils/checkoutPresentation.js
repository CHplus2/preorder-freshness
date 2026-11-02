import {validSellingDetails} from './sellingDetails.js';
import {responseList,invalidResponse} from './apiResponse.js';
import {accountDetails} from './customerExperience.js';

const positive=value=>Number.isSafeInteger(value) && value>0;
const money=value=>(typeof value==='number' || typeof value==='string') && /^\d+(?:\.\d{1,2})?$/.test(String(value));
export function basketRows(data){
 const rows=responseList(data);
 if(rows.some(row=>!validSellingDetails(row.product?.selling_details) || !positive(row.id) || !positive(row.quantity) || row.quantity>10000 || !positive(row.product?.id)
  || typeof row.product.name!=='string' || !row.product.name.trim() || !money(row.product.price)
  || !['active','paused','archived'].includes(row.product.selling_status))
  || new Set(rows.map(row=>row.id)).size!==rows.length)throw invalidResponse();
 basketTotals(rows,null);
 return rows;
}
export const pricingConfigured=store=>Number.isInteger(store?.bulk_discount_percent) && store.bulk_discount_percent>=0 && store.bulk_discount_percent<=100 && positive(store.bulk_minimum)
 && (store.delivery_fee_myr===undefined || money(store.delivery_fee_myr))
 && (store.free_delivery_minimum_myr==null || money(store.free_delivery_minimum_myr))
 && ['delivery_enabled','pickup_enabled'].every(key=>store[key]===undefined || typeof store[key]==='boolean')
 && ['delivery','pickup'].every(kind=>{
  const first=store[kind+'_open_hour'],last=store[kind+'_close_hour'];
  return first===undefined && last===undefined || Number.isInteger(first) && Number.isInteger(last) && first>=0 && first<last && last<=23;
 }) && (store.pickup_enabled!==true || typeof store.pickup_location==='string' && store.pickup_location.trim().length>0)
 && (store.delivery_areas===undefined || Array.isArray(store.delivery_areas) && store.delivery_areas.length<=30 && store.delivery_areas.every(s=>typeof s==='string' && s.trim().length>0 && s.length<=80));
export function basketTotals(cart,store,method='standard'){
 const cents=value=>{if(!money(value))throw invalidResponse();const [whole,fraction='']=String(value).split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));};
 const subtotal=cart.reduce((sum,row)=>sum+cents(row.product.price)*BigInt(row.quantity),0n);
 const portions=cart.reduce((sum,row)=>sum+row.quantity,0);
 let discount=0n;
 if(pricingConfigured(store) && portions>=store.bulk_minimum){
  const numerator=subtotal*BigInt(store.bulk_discount_percent),whole=numerator/100n,remainder=numerator%100n;
  // Match Django Decimal.quantize's half-even rounding at half a cent.
  discount=whole+(remainder>50n || remainder===50n && whole%2n===1n?1n:0n);
 }
 const threshold=store?.free_delivery_minimum_myr===undefined?5000n:store.free_delivery_minimum_myr===null?null:cents(store.free_delivery_minimum_myr);
 const shipping=method==='pickup' || threshold!==null && subtotal>=threshold?0n:cents(store?.delivery_fee_myr ?? '5.00');
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
