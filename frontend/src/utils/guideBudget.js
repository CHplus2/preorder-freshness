export const budgetModes=['within','above','all'];
export function moneyCents(value){
 if(!['string','number'].includes(typeof value))return null;
 const raw=String(value);
 const plain=/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(raw)?String(Number(raw)):raw;
 const match=plain.match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
 if(!match)return null;
 const cents=Number(match[1])*100+Number((match[2] || '').padEnd(2,'0'));
 return Number.isSafeInteger(cents)?cents:null;
}
export function budgetComparison(menu,budget){
 const total=moneyCents(menu.food_total),limit=moneyCents(budget);
 if(total===null || limit===null)return null;
 return {relation:total<=limit?'within':'above',difference:Math.abs(total-limit)/100};
}
export function budgetSummary(mode,amount,formatPrice){
 return `${mode==='above'?'above':mode==='all'?'within and above':'up to'} ${formatPrice(amount)} food total`;
}
export function budgetBadge(menu,budget,formatPrice){
 const comparison=budgetComparison(menu,budget);
 if(!comparison)return '';
 if(!comparison.difference)return 'Exactly on your budget';
 return `${formatPrice(comparison.difference)} ${comparison.relation==='within'?'under':'above'} your budget`;
}
export function budgetCatalogueMessage(catalogue,budget,formatPrice){
 if(!catalogue)return '';
 if(!catalogue.menu_count)return 'No active menus with recipes are open for this date and category.';
 const range=catalogue.minimum_food_total===catalogue.maximum_food_total?`cost ${formatPrice(catalogue.minimum_food_total)}`:`range from ${formatPrice(catalogue.minimum_food_total)} to ${formatPrice(catalogue.maximum_food_total)}`;
 const relation=!catalogue.above_count?`None is above ${formatPrice(budget)}.`:!catalogue.within_count?`None is within ${formatPrice(budget)}.`:`${catalogue.within_count} within ${formatPrice(budget)}; ${catalogue.above_count} above.`;
 return `Price check for ${catalogue.quantity} ${catalogue.quantity===1?'unit':'units'} of one menu: food totals ${range}. ${relation} Based on ${catalogue.menu_count} date/category matches with recipes, before kitchen availability checks.`;
}
