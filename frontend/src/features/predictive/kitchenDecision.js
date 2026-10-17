export const kitchenActions = [
  {id:'purchasing', title:'Adjust purchasing', detail:'Cover confirmed gaps first. Compare a dated purchase before buying for uncertain demand.'},
  {id:'menu', title:'Prioritise preparation & menus', detail:'Find menus that use the ingredient and review preparation dates, freshness and capacity.'},
  {id:'marketing', title:'Explore targeted marketing', detail:'Review a menu offer to use surplus before expiry. Customer response is an assumption, not a predicted uplift.'},
  {id:'wait', title:'Monitor & verify first', detail:'Resolve missing recipes, uncertain history or excluded orders before treating a scenario as an alert.'},
];
export function workflowLinks(risk, plan) {
  const query = new URLSearchParams({from:'freshcast',material:String(risk.raw_material_id),ingredient:risk.ingredient_name});
  return {inventory:`/admin/inventory?${query}`, planner:`/admin/planner?${query}&view=shopping&date=${plan.window.end_date}`,
    preparation:`/admin/planner?${query}&view=orders`, menus:`/admin/products?review=recipes`, marketing:'/admin/settings#promotions',
    outcomes:'/admin/reports#costs'};
}
export function marketingWorksheet({portions,discount,cost,menu,recipe,risk}) {
  if ([portions,discount,cost].some(v=>v==='') || !menu || !recipe) return null;
  const p=Number(portions), d=Number(discount), c=Number(cost);
  if (![p,d,c].every(Number.isFinite) || p<0 || p>10000 || d<0 || d>100 || c<0 || c>1e9) return null;
  const used=Math.min(risk.forecast_expiring_unused,p*recipe.quantity_per_portion);
  const unitMargin=menu.variable_cost_myr===null?null:menu.price_myr*(1-d/100)-menu.variable_cost_myr;
  return {portions:p, ingredientUsed:used, remaining:Math.max(0,risk.forecast_expiring_unused-used),
    revenue:p*menu.price_myr*(1-d/100), contribution:unitMargin===null?null:p*unitMargin-c,
    breakEven:unitMargin!==null && unitMargin>0?Math.ceil(c/unitMargin):null};
}
export function decisionSlip({plan,risk,action,reviewed,note,worksheet,signedReview=null}) {
  return JSON.stringify({source:'LOCAL_KITCHEN',as_of:plan.as_of,window:plan.window,
    action,ingredient:risk.ingredient_name,unit:risk.unit,baseline:risk,
    methods:plan.decision_support.menus.filter(m=>risk.menus.some(r=>r.product_id===m.product_id)).map(m=>({menu:m.product_name,method:m.method,evaluation:m.evaluation})),
    worksheet,reviewed,note,signed_review:signedReview,assumptions:plan.decision_support.assumptions,
    definition:'Advisory evidence only. Financial scenarios are assumptions, not realised savings or causal promotion uplift.'},null,2);
}

export function kitchenReadiness(support) {
  const menus = support.menus;
  return {
    menus: menus.length,
    forecasted: menus.filter((m) => m.forecast_portions !== null).length,
    evaluated: menus.filter((m) => m.confidence === "evaluated").length,
    missingRecipes: menus.filter((m) => !m.recipe_complete).length,
  };
}

export function riskTiming(risk, windowEnd) {
  const exposure = risk.shortfall_quantity > 0 || risk.forecast_shortfall > 0 || risk.forecast_expiring_unused > 0;
  if (!exposure) return 'No stock gap or projected unused quantity in the included evidence. Review data coverage before treating this as a risk.';
  return `${risk.signal==='review' || risk.signal==='watch'?'Review evidence by':'Review action by'} ${risk.urgent_by || windowEnd}. Forecast quantities are estimates; verify stock and preparation before acting.`;
}
