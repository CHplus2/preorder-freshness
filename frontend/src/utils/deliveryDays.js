const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function deliveryDaysText(value=[]) {
 return value.length ? `Delivery: ${value.map(day=>days[day]).join(', ')}` : 'Delivery: any day, subject to kitchen availability';
}

export function basketDeliveryDays(cart) {
 return days.map((_,i)=>i).filter(day=>cart.every(item=>!item.product.delivery_weekdays?.length || item.product.delivery_weekdays.includes(day)));
}
export function deliveryDayIssue(cart, value) {
 const common=basketDeliveryDays(cart);
 if(!common.length)return 'These items have no delivery weekday in common. Order them separately or change your basket.';
 if(!value)return '';
 const date=value.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
 const weekday=(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7;
 const blocked=cart.filter(item=>item.product.delivery_weekdays?.length && !item.product.delivery_weekdays.includes(weekday));
 return blocked.length ? `${blocked.map(item=>item.product.name).join(', ')} cannot be delivered on this day. Choose ${common.map(day=>days[day]).join(', ')}.` : '';
}
export function basketDaysText(cart) {
 const common=basketDeliveryDays(cart);
 return common.length===7?'Any weekday':common.map(day=>days[day]).join(', ');
}
