export const validDeliveryDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;

export const deliveryDateText=value=>new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-MY',{
 timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric'});

export function offeredDatesText(dates=[]) {
 return dates.slice(0,3).map(deliveryDateText).join(', ')+(dates.length>3?` + ${dates.length-3} more dates`:'');
}

export function cutoffText(product) {
 if(!product.order_cutoff_time)return '';
 const [hour,minute]=product.order_cutoff_time.split(':').map(Number);
 const clock=`${hour%12 || 12}:${String(minute).padStart(2,'0')} ${hour>=12?'pm':'am'}`;
 const days=product.order_cutoff_days_before ?? 1;
 return `Order before ${clock} ${days===0?'on the delivery day':days===1?'the day before delivery':`${days} days before delivery`} · Malaysia time`;
}

export function cutoffStamp(product, day) {
 if(!product.order_cutoff_time || !validDeliveryDate(day))return null;
 return Date.parse(`${day}T${product.order_cutoff_time.slice(0,5)}:00+08:00`)-(product.order_cutoff_days_before ?? 1)*86400000;
}

export function commonSpecificDates(cart) {
 let dates=null;
 for(const {product:p} of cart)if(p.delivery_dates?.length){
  dates=dates===null?[...p.delivery_dates]:dates.filter(day=>p.delivery_dates.includes(day));
 }
 return dates===null?null:dates.filter(day=>{
  const weekday=(new Date(`${day}T12:00:00Z`).getUTCDay()+6)%7;
  return cart.every(({product:p})=>!p.delivery_weekdays?.length || p.delivery_weekdays.includes(weekday));
 }).sort();
}
