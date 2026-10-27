const validDate=value=>typeof value==='string' && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const addDays=(start,days)=>{
 if(!validDate(start) || !Number.isInteger(Number(days)) || Number(days)<1)return null;
 const date=new Date(Date.parse(start+'T00:00:00Z')+Number(days)*86400000);
 if(!Number.isFinite(date.getTime()))return null;
 const result=date.toISOString().slice(0,10);
 return validDate(result)?result:null;
};
export function changeExpiryBasis(value,basis){
 const current=value.expiry_basis || 'label';
 const printed=value.original_expiry_date || (current==='label'?value.expiry_date:null) || null;
 return {...value,expiry_basis:basis,original_expiry_date:printed,expiry_date:basis==='label'?(printed || ''):value.expiry_date};
}
export function expiryPreview(value,today=null){
 const basis=value.expiry_basis || 'label';
 const base=basis==='label'?(value.original_expiry_date || value.expiry_date):addDays(basis==='manufactured'?value.manufactured_date:value.received_date,value.shelf_life_days);
 if(!validDate(value.received_date) || !validDate(base) || base<value.received_date || (today && value.received_date>today))return null;
 if(basis==='manufactured' && value.manufactured_date>value.received_date)return null;
 const dates=[base];
 if(value.original_expiry_date){
  if(!validDate(value.original_expiry_date) || value.original_expiry_date<value.received_date)return null;
  dates.push(value.original_expiry_date);
 }
 for(const [field,days] of [['opened_date','after_open_days'],['thawed_date','after_thaw_days']]){
  if(!!value[field]!==!!value[days])return null;
  if(value[field]){
   const end=addDays(value[field],value[days]);
   if(!end || value[field]<value.received_date || (today && value[field]>today))return null;
   dates.push(end);
  }
 }
 return {base,effective:dates.sort()[0]};
}
