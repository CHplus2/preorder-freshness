export const isPickup=order=>order?.delivery_method==='pickup';
export const handoverLabel=order=>isPickup(order)?'Collection':'Delivery';
export const methodLabel=method=>method==='pickup'?'Self-collection':method==='express'?'Delivery · express requested':'Delivery';
export const fulfilmentHours=(store,method)=>method==='pickup'?[store?.pickup_open_hour ?? 8,store?.pickup_close_hour ?? 20]:[store?.delivery_open_hour ?? 9,store?.delivery_close_hour ?? 21];
export const hourLabel=hour=>`${hour%12 || 12}${hour>=12?'pm':'am'}`;
export const methodsFor=store=>[...(store?.delivery_enabled!==false?['standard','express']:[]),...(store?.pickup_enabled===true && typeof store.pickup_location==='string' && store.pickup_location.trim()?['pickup']:[])];
export const fulfilmentKey=(store,method,area='',minutes=0)=>JSON.stringify([method,area,minutes,store?.delivery_enabled,store?.pickup_enabled,store?.pickup_location,store?.pickup_instructions,store?.delivery_areas,store?.delivery_open_hour,store?.delivery_close_hour,store?.pickup_open_hour,store?.pickup_close_hour,store?.delivery_buffer_minutes,store?.delivery_fee_myr,store?.free_delivery_minimum_myr]);
