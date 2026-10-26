export const sellingUnits={item:['item','items'],portion:['portion','portions'],box:['box','boxes'],pack:['pack','packs'],set:['set','sets'],tray:['tray','trays'],jar:['jar','jars'],bottle:['bottle','bottles']};
import {validDeliveryDate,deliveryDateText} from './preorderWindows.js';
export const emptySellingDetails=()=>({unit:'item',size_label:'',serves_min:null,serves_max:null,contents:'',no_substitutions:false,ordering_mode:'local_preorder',dispatch_from:null,dispatch_through:null,shipping_note:''});
export const shippingEnquiry=details=>details?.ordering_mode==='shipping_enquiry';
export const shippingContact=id=>`/contact?topic=shipping${Number.isSafeInteger(Number(id))&&Number(id)>0?'&menu='+Number(id):''}`;
export function dispatchWindow(details){
 const start=details?.dispatch_from,end=details?.dispatch_through;
 if(!start || !end)return '';
 if(start===end)return deliveryDateText(end);
 return start.slice(0,7)===end.slice(0,7)?`${Number(start.slice(-2))}–${deliveryDateText(end)}`:`${deliveryDateText(start)}–${deliveryDateText(end)}`;
}
export const unitLabel=(details,quantity=1)=>sellingUnits[details?.unit]?.[Number(quantity)===1?0:1] || (Number(quantity)===1?'item':'items');
export const quantityLabel=(details,quantity)=>`${quantity} ${unitLabel(details,quantity)}`;
export function validSellingDetails(value){
 if(value===undefined)return true;
 if(!value || typeof value!=='object' || Array.isArray(value))return false;
 const allowed=Object.keys(emptySellingDetails());
 if(Object.keys(value).some(key=>!allowed.includes(key)))return false;
 const v={...emptySellingDetails(),...value};
 return Object.hasOwn(sellingUnits,v.unit) && typeof v.size_label==='string' && [...v.size_label].length<=60
  && typeof v.contents==='string' && [...v.contents].length<=500 && typeof v.no_substitutions==='boolean'
  && (!v.no_substitutions || v.contents.trim().length>0)
  && ['local_preorder','shipping_enquiry'].includes(v.ordering_mode)
  && typeof v.shipping_note==='string' && [...v.shipping_note].length<=300
  && (v.dispatch_from===null && v.dispatch_through===null || validDeliveryDate(v.dispatch_from) && validDeliveryDate(v.dispatch_through) && v.dispatch_from<=v.dispatch_through && Date.parse(v.dispatch_through)-Date.parse(v.dispatch_from)<=365*86400000)
  && (!shippingEnquiry(v) || v.dispatch_from!==null)
  && (v.serves_min===null && v.serves_max===null || Number.isInteger(v.serves_min) && Number.isInteger(v.serves_max) && v.serves_min>=1 && v.serves_min<=v.serves_max && v.serves_max<=1000);
}
export function servingLabel(details){
 if(!Number.isInteger(details?.serves_min) || !Number.isInteger(details?.serves_max))return '';
 return `Serves ${details.serves_min===details.serves_max?details.serves_min:details.serves_min+'–'+details.serves_max} (estimate)`;
}
