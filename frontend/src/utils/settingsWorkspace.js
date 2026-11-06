export const settingGroups={
 identity:['name','founder_name','tagline','service_area','contact_email','whatsapp_number','social_url'],
 story:['story','founder_intro','founding_story','food_philosophy','signature_food','founder_image_url'],
 promotion:['bulk_minimum','bulk_discount_percent'],
 cooking:['kitchen_open_hour','kitchen_close_hour','delivery_buffer_minutes'],
 payments:['bank_transfer_instructions','duitnow_qr_url','manual_payment_enabled'],
 fulfilment:['pickup_enabled','pickup_location','pickup_instructions','pickup_open_hour','pickup_close_hour','delivery_enabled','delivery_open_hour','delivery_close_hour','delivery_fee_myr','free_delivery_minimum_myr','delivery_areas','delivery_area_fees'],
};
export function settingsPayload(key,store){
 if(!Object.hasOwn(settingGroups,key))throw new Error('Unknown settings section.');
 return Object.fromEntries(settingGroups[key].filter(field=>store[field]!==undefined).map(field=>[field,store[field]]));
}
export function savedSettings(current,response,keys){
 if(!response||typeof response!=='object'||Array.isArray(response)||keys.some(key=>!Object.hasOwn(response,key)))throw new Error('The saved settings could not be verified. Refresh to check the current values.');
 return {...current,...Object.fromEntries(keys.map(key=>[key,response[key]]))};
}
export function revealSettingsTarget(id){
 const target=document.getElementById(id);if(!target)return false;
 for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
 if(!target.matches('input,textarea,select,button,a[href],summary'))target.setAttribute('tabindex','-1');target.scrollIntoView({block:'start'});
 const field=target.matches('input,textarea,select')?target:target.querySelector('input:not([type=file]),textarea,select');
 (field||target).focus({preventScroll:true});return true;
}
