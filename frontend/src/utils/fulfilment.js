export const isPickup=order=>order?.delivery_method==='pickup';
export const handoverLabel=order=>isPickup(order)?'Collection':'Delivery';
export const methodLabel=method=>method==='pickup'?'Self-collection':'Delivery';
export const fulfilmentHours=(store,method)=>method==='pickup'?[store?.pickup_open_hour ?? 8,store?.pickup_close_hour ?? 20]:[store?.delivery_open_hour ?? 9,store?.delivery_close_hour ?? 21];
export const hourLabel=hour=>`${hour%12 || 12}${hour>=12?'pm':'am'}`;
export const methodsFor=store=>[...(store?.delivery_enabled!==false?['standard']:[]),...(store?.pickup_enabled===true && typeof store.pickup_location==='string' && store.pickup_location.trim()?['pickup']:[])];
export const fulfilmentKey=(store,method,area='',minutes=0)=>JSON.stringify([method,area,minutes,store?.delivery_enabled,store?.pickup_enabled,store?.pickup_location,store?.pickup_instructions,store?.delivery_areas,store?.delivery_open_hour,store?.delivery_close_hour,store?.pickup_open_hour,store?.pickup_close_hour,store?.delivery_buffer_minutes,store?.delivery_fee_myr,store?.free_delivery_minimum_myr,store?.delivery_area_fees,store?.delivery_start_time,store?.delivery_end_time,store?.pickup_start_time,store?.pickup_end_time]);

export const fulfilmentTimes=(store,method)=>{
 const kind=method==='pickup'?'pickup':'delivery';
 return store?.ordering_mode==='simple'?[(store[kind+'_start_time']||'07:30').slice(0,5),(store[kind+'_end_time']||'11:00').slice(0,5)]:fulfilmentHours(store,method).map(h=>String(h).padStart(2,'0')+':00');
};
export const timeLabel=value=>{const [h,m]=value.split(':').map(Number);return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''}${h>=12?'pm':'am'}`};
