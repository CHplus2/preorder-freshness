export function contactNumber(value=''){
 const raw=String(value).trim();
 if(!/^\+?[0-9 ()-]+$/.test(raw))return '';
 let digits=raw.replace(/\D/g,'');
 if(!raw.startsWith('+') && digits.startsWith('0'))digits='60'+digits.slice(1);
 else if(!raw.startsWith('+') && !digits.startsWith('60'))return '';
 return /^[1-9][0-9]{7,14}$/.test(digits)?'+'+digits:'';
}
export function handoverDetails(order){
 const saved=order.fulfilment_snapshot?.handover || {};
 return {contact_phone:saved.contact_phone || order.address?.phone || '',contact_method:saved.contact_method || 'phone',mode:saved.mode || 'in_person',location:saved.location || '',notes:saved.notes || ''};
}
export function orderContact(order){
 const saved=handoverDetails(order),phone=contactNumber(saved.contact_phone);
 const stamp=Date.parse(order.delivery_at);
 const when=Number.isFinite(stamp)?new Date(stamp).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'a time to agree with the kitchen';
 const pickup=order.delivery_method==='pickup';
 let text;
 if(order.status==='shipped')text=`The kitchen has marked order #${order.id} out for delivery. Please arrange for someone to receive it. Check My orders for the courier tracking link, if provided.`;
 else if(order.preparation_plan?.needs_review)text=`About order #${order.id}: your requested ${pickup?'collection':'delivery'} time is ${when} Malaysia time. It still needs kitchen confirmation. Please contact us to agree arrangements.`;
 else text=`A reminder about order #${order.id}: ${pickup?'collection':'delivery'} is scheduled for ${when} Malaysia time. ${pickup?'Please be ready to collect your order.':'Please arrange for someone to receive your food.'} Let us know if your arrangements have changed.`;
 return {phone,text,whatsapp:saved.contact_method==='whatsapp' && phone?`https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(text)}`:null};
}
