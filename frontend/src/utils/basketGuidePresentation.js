import {deliveryDateLabel} from './deliverySlots.js';
import {moneyCents} from './guideBudget.js';

export function basketSearchDescription(data,category,formatPrice){
 const budget=data.budget;
 const price=budget?`${budget.mode==='above'?'Above':budget.mode==='all'?'Within and above':'Up to'} ${formatPrice(budget.amount)} whole-order total`:'No budget limit';
 return {title:`${deliveryDateLabel(data.date)} · ${data.quantity} ${data.quantity===1?'item':'items'} total`,
  details:`${price} · ${data.menu_mode==='same'?'One menu only':'Allow a mix'} · ${category?`${data.replaces_basket?'Menu category':'New items'}: ${category}`:data.replaces_basket?'Any category':'Any category for new items'}`,
  existing:data.current_quantity?`${data.current_quantity} ${data.current_quantity===1?'item already':'items already'} in your basket${data.replaces_basket?' · replaced only after you confirm':''}`:''};
}

export function basketRecoveryActions(data,category){
 if(data.empty_reason==='existing_menu_mix')return ['allow_mix'];
 if(data.empty_reason==='quantity_below_basket')return data.current_quantity<=100?['basket_quantity']:[];
 if(data.empty_reason==='no_price_match')return data.budget && data.budget.mode!=='all'?['compare_budget']:[];
 if(data.empty_reason==='no_menu_match' || data.empty_reason==='no_kitchen_times')return [...(category?['any_category']:[]),'change_date'];
 return [];
}

export function basketPriceExplanation(data,formatPrice){
 const e=data.price_evidence;
 if(data.empty_reason!=='no_price_match' || !e?.considered_baskets || !data.budget)return '';
 const low=formatPrice(e.minimum_order_total),high=formatPrice(e.maximum_order_total);
 const range=moneyCents(e.minimum_order_total)===moneyCents(e.maximum_order_total)?`The proposed baskets total ${low}.`:`Proposed basket totals range from ${low} to ${high}.`;
 const why=e.above_count===0?`None of these proposed combinations is above ${formatPrice(data.budget.amount)}.`:e.within_count===0?`None of these proposed combinations is within ${formatPrice(data.budget.amount)}.`:'';
 return `${range} ${why} These are price comparisons, before kitchen availability checks.`;
}

export function basketRangeNotice(data){
 if(data.budget?.mode!=='all' || !data.plans.length)return '';
 const relations=new Set(data.plans.map(plan=>plan.budget_relation));
 if(relations.size>1)return '';
 return relations.has('within')?'The options found are within your budget. No over-budget option was found in this search.':'The options found are above your budget. No within-budget option was found in this search.';
}
