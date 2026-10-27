import {validSellingDetails} from './sellingDetails.js';
import {invalidResponse, responseSlots} from './apiResponse.js';
import {moneyCents,budgetModes,budgetComparison} from './guideBudget.js';

export function guideResponse(data,request=null) {
  if (!data || typeof data.session !== 'string' || !data.session ||
      typeof data.message !== 'string' || !Array.isArray(data.results) || data.results.length>3 || new Set(data.results.map(row=>row?.id)).size!==data.results.length) throw invalidResponse();
  if(data.empty_reason!=null && !['category_unavailable','no_kitchen_times','no_menu_match','shipping_enquiry'].includes(data.empty_reason))throw invalidResponse();
  const budget=request?.budget?moneyCents(request.budget):null,mode=request?.budget_mode || 'within';
  if(request && (!Number.isInteger(Number(request.portions)) || Number(request.portions)<1 || Number(request.portions)>100 || !budgetModes.includes(mode) || (request.budget && (budget===null || budget<1)) || (mode!=='within' && budget===null)))throw invalidResponse();
  if(data.budget!=null && (moneyCents(data.budget.amount)===null || !budgetModes.includes(data.budget.mode) || data.budget.basis!=='food_total_before_discounts_and_delivery'
    || (request && (moneyCents(data.budget.amount)!==budget || data.budget.mode!==mode))))throw invalidResponse();
  if(data.budget_catalogue!=null){
    const c=data.budget_catalogue,limit=budget ?? moneyCents(data.budget?.amount),minimum=moneyCents(c.minimum_food_total),maximum=moneyCents(c.maximum_food_total);
    if(c.scope!=='date_category_recipes_before_capacity' || !Number.isInteger(c.quantity) || c.quantity<1 || c.quantity>100 || (request && c.quantity!==Number(request.portions))
      || ['menu_count','within_count','above_count'].some(key=>!Number.isSafeInteger(c[key]) || c[key]<0) || c.within_count+c.above_count!==c.menu_count || limit===null
      || (c.menu_count===0?(c.minimum_food_total!==null || c.maximum_food_total!==null):(minimum===null || maximum===null || minimum>maximum
        || (!c.above_count && maximum>limit) || (!c.within_count && minimum<=limit) || (c.above_count && c.within_count && !(minimum<=limit && maximum>limit)))))throw invalidResponse();
  }
  for (const row of data.results) {
    if (!row || !validSellingDetails(row.selling_details) || !Number.isInteger(row.id) || row.id < 1 || typeof row.name !== 'string' ||
        !Number.isInteger(row.portions) || row.portions < 1 ||
        !['number', 'string'].includes(typeof row.food_total) || String(row.food_total).trim() === '' ||
        !Number.isFinite(Number(row.food_total)) || Number(row.food_total) < 0 ||
        !Array.isArray(row.reasons) || row.reasons.some(reason => typeof reason !== 'string')) throw invalidResponse();
    if (!responseSlots(row).length) throw invalidResponse();
    const total=moneyCents(row.food_total),price=moneyCents(row.price);
    if(total===null || ((request || row.price!==undefined) && (price===null || price*row.portions!==total)) || (request && row.portions!==Number(request.portions)))throw invalidResponse();
    if(budget!==null){
      const comparison=budgetComparison(row,request.budget);
      if((mode!=='all' && comparison.relation!==mode) || (row.budget_relation!=null && row.budget_relation!==comparison.relation)
        || (row.budget_difference!=null && moneyCents(row.budget_difference)!==Math.abs(total-budget)))throw invalidResponse();
    }
  }
  if(data.budget_catalogue){
    const c=data.budget_catalogue,limit=budget ?? moneyCents(data.budget?.amount);
    const within=data.results.filter(row=>moneyCents(row.food_total)<=limit).length;
    if(data.results.length>c.menu_count || within>c.within_count || data.results.length-within>c.above_count
      || data.results.some(row=>row.portions!==c.quantity || moneyCents(row.food_total)<moneyCents(c.minimum_food_total) || moneyCents(row.food_total)>moneyCents(c.maximum_food_total)))throw invalidResponse();
  }
  return data;
}

// These preferences are optional; checkout still asks for and validates a delivery time.
export function rememberSuggestion(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* Private storage must not block the basket. */ }
}
