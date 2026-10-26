export function deliveryRunRequest(start,minutes,orderId,now=Date.now()){
 const stamp=Date.parse(start+':00+08:00'),amount=Number(minutes);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) || !Number.isFinite(stamp) || stamp<=now || !Number.isInteger(amount) || amount<1 || amount>720)throw new Error('Choose a future departure and the number of minutes you will be away.');
 return {start_at:start+':00+08:00',end_at:new Date(stamp+amount*60000).toISOString(),reason:`Owner delivery run for order #${orderId}`};
}
