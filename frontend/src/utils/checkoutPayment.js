export function manualPaymentAvailable(store,method){
 return store?.manual_payment_enabled===true&&Boolean(store.duitnow_qr_url||(method!=='pickup'&&store.bank_transfer_instructions?.trim()));
}
export function confirmedCheckoutPrice(pricing,{total,discount,shipping,finalTotal}){
 if(!pricing||['food_subtotal','discount','delivery_fee','total'].some(key=>typeof pricing[key]!=='string'||!/^\d+\.\d{2}$/.test(pricing[key])))return false;
 return Number(pricing.food_subtotal)===total&&Number(pricing.discount)===discount&&Number(pricing.delivery_fee)===shipping&&Number(pricing.total)===finalTotal;
}
