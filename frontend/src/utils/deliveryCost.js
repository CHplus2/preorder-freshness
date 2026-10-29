// Owner-entered planning example only; never used for checkout pricing.
export function deliveryCostCheck(fee,quote){
 const cents=value=>{
  if(!['string','number'].includes(typeof value) || !/^\d+(?:\.\d{1,2})?$/.test(String(value)))return null;
  const [whole,fraction='']=String(value).split('.');
  const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(amount) && amount<=99999999?amount:null;
 };
 const customer=cents(fee),courier=cents(quote);
 if(customer===null || courier===null)return null;
 return {customer:customer/100,courier:courier/100,coveredByShop:Math.max(0,courier-customer)/100,remaining:Math.max(0,customer-courier)/100};
}
