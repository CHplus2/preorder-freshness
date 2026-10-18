export const generatedSalesHistory = order =>
  order.payment_instructions?.freshcast_synthetic_history?.version === '1';

// An unexpected open record must remain visible in the operational queue.
export const closedGeneratedHistory = order => generatedSalesHistory(order) &&
  ['delivered', 'cancelled'].includes(order.status);

export const orderStatusLabel = status => ({pending:'Not started',processing:'Preparing',
  cooked:'Ready for delivery',shipped:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'}[status] || status);

export const orderDate = (value,withTime=true) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',
      month:'short',year:'numeric',...(withTime?{hour:'numeric',minute:'2-digit'}:{})}) : 'Not scheduled';
