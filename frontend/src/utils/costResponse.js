import {invalidResponse, responseList} from './apiResponse.js';
const number=v=>(typeof v==='number' || typeof v==='string' && v.trim()!=='') && Number.isFinite(Number(v));
const optional=v=>v===null || number(v);
const count=v=>Number.isInteger(v) && v>=0;
const strings=v=>Array.isArray(v) && v.every(s=>typeof s==='string');
const date=v=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));
const requireValid=condition=>{if(!condition)throw invalidResponse()};

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
