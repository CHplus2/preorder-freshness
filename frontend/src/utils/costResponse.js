import {invalidResponse, responseList} from './apiResponse.js';
const number=v=>(typeof v==='number' || typeof v==='string' && v.trim()!=='') && Number.isFinite(Number(v));
const optional=v=>v===null || number(v);
const count=v=>Number.isInteger(v) && v>=0;
const strings=v=>Array.isArray(v) && v.every(s=>typeof s==='string');
const date=v=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));
const requireValid=condition=>{if(!condition)throw invalidResponse()};
const id=v=>Number.isInteger(v) && v>0;
const nonnegative=v=>number(v) && Number(v)>=0;

export function pricingResponse(data) {
 requireValid(data && typeof data.menu==='string' && typeof data.definition==='string' && id(data.portions) && id(data.current_bulk_minimum) && strings(data.missing) && optional(data.contribution_change));
 requireValid(data.assumptions && ['ingredient_increase_percent','additional_cost_per_portion'].every(key=>nonnegative(data.assumptions[key])));
 for(const key of ['baseline','proposed']) {
  const row=data[key];
  requireValid(row && ['price','discount_percent','food_revenue','additional_cost'].every(field=>nonnegative(row[field])) && ['ingredient_cost','packaging_cost','contribution','margin_percent','per_portion','break_even_price'].every(field=>optional(row[field])) && (row.below_cost===null || typeof row.below_cost==='boolean'));
 }
 return data;
}

export function costMaterials(data) {
 const rows=responseList(data);
 for(const row of rows)requireValid(id(row.id) && typeof row.name==='string' && typeof row.unit==='string' && (row.estimated_unit_cost===null || nonnegative(row.estimated_unit_cost)));
 return rows;
}
export function costLots(data) {
 const rows=responseList(data);
 for(const row of rows)requireValid(id(row.id) && typeof row.raw_material_name==='string' && typeof row.unit==='string' && typeof row.batch_code==='string' && nonnegative(row.quantity));
 return rows;
}
export function costExpenses(data) {
 const rows=responseList(data);
 for(const row of rows)requireValid(id(row.id) && date(row.date) && nonnegative(row.amount) && typeof row.category==='string' && typeof row.note==='string' && typeof row.voided==='boolean');
 return rows;
}

export function costReport(data) {
 requireValid(data && date(data.start) && date(data.end) && number(data.operating_expenses) && number(data.known_waste_cost) && count(data.unpriced_waste_records));
 for(const row of responseList(data.menus))requireValid(count(row.id) && typeof row.name==='string' && number(row.price) && strings(row.missing) && ['ingredient_cost','packaging_cost','estimated_contribution','estimated_margin_percent'].every(key=>optional(row[key])));
 for(const row of responseList(data.waste))requireValid(count(row.id) && ['material','unit','reason'].every(key=>typeof row[key]==='string') && date(row.date) && number(row.quantity) && optional(row.cost));
 return data;
}

export function contributionReport(data) {
 requireValid(data && date(data.start) && date(data.end) && typeof data.definition==='string' && number(data.known_contribution) && ['complete_orders','shown','order_count'].every(key=>count(data[key])));
 const rows=responseList(data.rows);
 requireValid(data.shown===rows.length && data.order_count>=data.shown && data.complete_orders<=data.shown);
 for(const row of rows){
  requireValid(count(row.order) && typeof row.status==='string' && typeof row.realised==='boolean' && strings(row.missing) && ['net_food_revenue','known_ingredient_cost','accepted_packaging_cost'].every(key=>number(row[key])) && optional(row.food_contribution));
  for(const trace of responseList(row.trace))requireValid(['menu','unit','material','batch_code'].every(key=>typeof trace[key]==='string') && number(trace.quantity) && optional(trace.unit_cost) && date(trace.recorded_expiry));
 }
 return data;
}
