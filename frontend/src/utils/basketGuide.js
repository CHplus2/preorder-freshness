import {invalidResponse,responseSlots} from './apiResponse.js';
import {moneyCents} from './guideBudget.js';
import {deliveryInput} from './deliverySlots.js';
import {validSellingDetails} from './sellingDetails.js';
const count=value=>Number.isSafeInteger(value) && value>=0;
export function orderQuote(value,quantity=null){
 if(!value || !count(value.quantity) || (quantity!==null && value.quantity!==quantity))throw invalidResponse();
 const [subtotal,discount,shipping,total]=['subtotal','discount','shipping','total'].map(key=>moneyCents(value[key]));
 if([subtotal,discount,shipping,total].some(value=>value===null) || discount>subtotal || total!==subtotal-discount+shipping)throw invalidResponse();
 return value;
}
export function basketGuideResponse(data,request){
 if(!data || data.version!=='mixed-basket-guide-v1' || typeof data.session!=='string' || !data.session || data.date!==request.date
  || data.quantity!==Number(request.quantity) || !count(data.quantity) || data.quantity<1 || data.quantity>100 || !count(data.current_quantity)
  || typeof data.basket_known!=='boolean' || !['standard','express','pickup'].includes(data.delivery_method)
  || (request.delivery_method && data.delivery_method!==request.delivery_method) || !Array.isArray(data.plans) || data.plans.length>3
  || new Set(data.plans.map(plan=>plan?.id)).size!==data.plans.length || typeof data.message!=='string')throw invalidResponse();
 const menuMode=data.menu_mode ?? 'mixed';
 if(!['mixed','same'].includes(menuMode) || menuMode!==(request.menu_mode ?? 'mixed'))throw invalidResponse();
 const replaces=data.replaces_basket ?? false;
 if(typeof replaces!=='boolean' || (replaces && (menuMode!=='same' || !data.basket_known || data.current_quantity<1)))throw invalidResponse();
 orderQuote(data.basket_before,data.current_quantity);
 const budget=request.budget?moneyCents(request.budget):null,mode=request.budget_mode || 'within';
 if((request.budget && (budget===null || budget<1)) || !['within','above','all'].includes(mode) || (mode!=='within' && budget===null) || (!data.basket_known && data.current_quantity!==0))throw invalidResponse();
 if(budget!==null && (budget<1 || !data.budget || data.budget.basis!=='whole_order_after_discount_and_delivery' || moneyCents(data.budget.amount)!==budget || data.budget.mode!==mode))throw invalidResponse();
 if(budget===null && data.budget!==null)throw invalidResponse();
 if(data.empty_reason!=null && !['quantity_below_basket','existing_menu_mix','basket_needs_review','no_price_match','no_kitchen_times','no_menu_match'].includes(data.empty_reason))throw invalidResponse();
 if((data.plans.length>0)!==(data.empty_reason===null))throw invalidResponse();
 for(const plan of data.plans){
  if(!/^bp_[0-9a-f]{16}$/.test(plan.id) || !Array.isArray(plan.items) || !plan.items.length || new Set(plan.items.map(item=>item?.id)).size!==plan.items.length || !responseSlots(plan).length)throw invalidResponse();
  if(menuMode==='same' && plan.items.length!==1)throw invalidResponse();
  const slots=responseSlots(plan);
  if(slots.length>3 || new Set(slots.map(slot=>Date.parse(slot.delivery_at))).size!==slots.length
   || slots.some(slot=>deliveryInput(slot.delivery_at).slice(0,10)!==data.date || slot.arrival_window!=null))throw invalidResponse();
  orderQuote(plan.totals,data.quantity);
  let quantity=0,old=0,added=0,subtotal=0;
  for(const item of plan.items){
   if(!Number.isSafeInteger(item.id) || item.id<1 || typeof item.name!=='string' || typeof item.image_url!=='string' || !validSellingDetails(item.selling_details)
    || !count(item.quantity) || item.quantity<1 || !count(item.existing_quantity) || !count(item.add_quantity) || item.existing_quantity+item.add_quantity!==item.quantity
    || !Array.isArray(item.reasons) || item.reasons.some(reason=>typeof reason!=='string'))throw invalidResponse();
   const price=moneyCents(item.price),line=moneyCents(item.line_total);
   if(price===null || line===null || price*item.quantity!==line)throw invalidResponse();
   quantity+=item.quantity;old+=item.existing_quantity;added+=item.add_quantity;subtotal+=line;
  }
  const kept=replaces?0:data.current_quantity;
  if(quantity!==data.quantity || old!==kept || added!==data.quantity-kept || subtotal!==moneyCents(plan.totals.subtotal))throw invalidResponse();
  const relation=budget===null?null:moneyCents(plan.totals.total)<=budget?'within':'above';
  if(plan.budget_relation!==relation || (budget!==null && mode!=='all' && relation!==mode))throw invalidResponse();
 }
 if(data.price_evidence!=null){
  const e=data.price_evidence,min=moneyCents(e.minimum_order_total),max=moneyCents(e.maximum_order_total);
  if(budget===null || e.scope!=='generated_combinations_before_capacity' || ['considered_baskets','within_count','above_count'].some(key=>!count(e[key])) || e.within_count+e.above_count!==e.considered_baskets
   || (e.considered_baskets===0?e.minimum_order_total!==null || e.maximum_order_total!==null:min===null || max===null || min>max || (!e.above_count && max>budget) || (!e.within_count && min<=budget)
    || (e.above_count && e.within_count && !(min<=budget && max>budget)))
   || data.plans.some(plan=>moneyCents(plan.totals.total)<min || moneyCents(plan.totals.total)>max))throw invalidResponse();
 }
 return data;
}
export function basketPlanAdded(value,expected){
 if((value?.replaced_basket ?? false)!==(expected.replace_basket ?? false))throw invalidResponse();
 if(!value || value.added!==true || value.session!==expected.session || value.plan!==expected.plan.id || value.quantity!==expected.quantity
  || value.added_quantity!==expected.plan.items.reduce((sum,item)=>sum+item.add_quantity,0)
  || typeof value.already_applied!=='boolean' || typeof value.basket_changed!=='boolean')throw invalidResponse();
 if(expected.date_only){
  if(value.date_only!==true || value.delivery_at!==null || value.date!==expected.date)throw invalidResponse();
 }else if(value.date_only===true || !Number.isFinite(Date.parse(value.delivery_at)) || Date.parse(value.delivery_at)!==Date.parse(expected.delivery_at))throw invalidResponse();
 orderQuote(value.totals,expected.quantity);
 if(['subtotal','discount','shipping','total'].some(key=>moneyCents(value.totals[key])!==moneyCents(expected.plan.totals[key])))throw invalidResponse();
 return value;
}
export function basketGuideEmpty(reason,quantity,current,menuMode='mixed'){
 if(reason==='existing_menu_mix')return 'Your basket already contains different menus. Allow a mix to keep these items, or edit your basket to use one menu only.';
 if(reason==='quantity_below_basket' && current>100)return `Your basket already has ${current} items. This finder supports up to 100 total items; edit your basket to use it.`;
 if(reason==='quantity_below_basket')return `Your basket already has ${current} items. Choose a total of at least ${current}, or edit your basket first.`;
 if(reason==='basket_needs_review')return 'An existing basket item needs review for this date. Review your basket before building a complete order.';
 if(reason==='no_price_match')return 'No proposed basket matches this budget range. Try another budget or compare both ranges.';
 if(reason==='no_kitchen_times')return 'No common kitchen time was found for these complete baskets. Try another date, quantity or preference.';
 if(menuMode==='same')return `No one-menu option was found for ${quantity} total items. Try another preference, date or quantity.`;
 return `No combination was found for ${quantity} total items. Try another preference, date or quantity.`;
}
