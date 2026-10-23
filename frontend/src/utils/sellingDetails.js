export const sellingUnits={item:['item','items'],portion:['portion','portions'],box:['box','boxes'],pack:['pack','packs'],set:['set','sets'],tray:['tray','trays'],jar:['jar','jars'],bottle:['bottle','bottles']};
export const emptySellingDetails=()=>({unit:'item',size_label:'',serves_min:null,serves_max:null,contents:'',no_substitutions:false});
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
  && (v.serves_min===null && v.serves_max===null || Number.isInteger(v.serves_min) && Number.isInteger(v.serves_max) && v.serves_min>=1 && v.serves_min<=v.serves_max && v.serves_max<=1000);
}
export function servingLabel(details){
 if(!Number.isInteger(details?.serves_min) || !Number.isInteger(details?.serves_max))return '';
 return `Serves ${details.serves_min===details.serves_max?details.serves_min:details.serves_min+'–'+details.serves_max} (estimate)`;
}
