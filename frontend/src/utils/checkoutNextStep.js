// Explains existing checkout guards; it never grants permission to submit.
export function checkoutNextStep({updating=false,pickup=false,areaIssue=false,addressLoading=false,addressError='',saving=false,hasAddress=false,addressEditing=false,weekdayIssue='',deliveryAt='',checking=false,quoteError='',quote=null,requestMode=false,paymentAvailable=true}={}){
 if(updating)return {message:'Updating basket and totals…'};
 if(areaIssue)return {message:'Choose a delivery area',href:'#checkout-receive'};
 if(!pickup){
  if(addressLoading)return {message:'Loading your delivery address…'};
  if(addressError && !addressEditing)return {message:'Reload your delivery address',href:'#checkout-address-title'};
  if(saving)return {message:'Saving your delivery address…'};
  if(!hasAddress || addressEditing)return {message:'Save your delivery address',href:'#checkout-address-title'};
 }
 if(weekdayIssue)return {message:'Review the menus’ offered days',href:'/cart'};
 const label=pickup?'collection':'delivery';
 if(!deliveryAt)return {message:`Choose a ${label} time`,href:'#checkout-time'};
 if(checking)return {message:'Checking your selected time…'};
 if(quoteError)return {message:`Review your ${label} time`,href:'#checkout-time'};
 if(!quote || (quote.plan.needs_review && !requestMode))return {message:'Review kitchen availability',href:'#checkout-time'};
 if(!paymentAvailable)return {message:'Choose a payment method',href:'#checkout-payment'};
 return null;
}
