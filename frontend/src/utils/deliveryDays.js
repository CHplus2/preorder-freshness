import {commonSpecificDates,cutoffStamp,cutoffText,offeredDatesText} from './preorderWindows.js';
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function deliveryDaysText(value=[]) {
 return value.length ? `Delivery: ${value.map(day=>days[day]).join(', ')}` : 'Delivery: any day, subject to kitchen availability';
}

export function basketDeliveryDays(cart) {
 return days.map((_,i)=>i).filter(day=>cart.every(item=>!item.product.delivery_weekdays?.length || item.product.delivery_weekdays.includes(day)));
}
export function deliveryDayIssue(cart, value, now=Date.now()) {
 const dates=commonSpecificDates(cart);
 if(dates!==null && !dates.length)return 'These items have no offered delivery date in common. Order them separately or change your basket.';
 const common=basketDeliveryDays(cart);
 if(!common.length)return 'These items have no delivery weekday in common. Order them separately or change your basket.';
 if(!value)return '';
 const date=value.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
 const unavailable=cart.filter(({product:p})=>p.delivery_dates?.length && !p.delivery_dates.includes(date));
 if(unavailable.length)return `${unavailable.map(({product:p})=>p.name).join(', ')} is not offered on this date. Choose an offered date or change your basket.`;
 const closed=cart.filter(({product:p})=>{const cutoff=cutoffStamp(p,date);return cutoff!==null && now>=cutoff;});
 if(closed.length)return `Ordering has closed for ${closed.map(({product:p})=>p.name).join(', ')} on this date. Choose a later offered date or contact the kitchen.`;
 const weekday=(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7;
 const blocked=cart.filter(item=>item.product.delivery_weekdays?.length && !item.product.delivery_weekdays.includes(weekday));
 return blocked.length ? `${blocked.map(item=>item.product.name).join(', ')} cannot be delivered on this day. Choose ${common.map(day=>days[day]).join(', ')}.` : '';
}
export function basketDaysText(cart) {
 const dates=commonSpecificDates(cart);
 if(dates!==null)return offeredDatesText(dates);
 const common=basketDeliveryDays(cart);
 return common.length===7?'Any weekday':common.map(day=>days[day]).join(', ');
}
export const basketCutoffs=cart=>cart.filter(({product:p})=>p.order_cutoff_time).map(({product:p})=>`${p.name}: ${cutoffText(p)}.`);
