const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function deliveryDaysText(value=[]) {
 return value.length ? `Delivery: ${value.map(day=>days[day]).join(', ')}` : 'Delivery: any day, subject to kitchen availability';
}
