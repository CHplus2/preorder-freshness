import {invalidResponse} from './apiResponse.js';

const integer=(value,min=0,max=1e9)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const identity=value=>integer(value,1,Number.MAX_SAFE_INTEGER);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const unique=rows=>new Set(rows.map(row=>row?.id)).size===rows.length;
const name=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200;

export function packagingRecords(data){
 if(!Array.isArray(data)||!unique(data)||data.some(row=>!row||!identity(row.id)||!name(row.name)
  ||!integer(row.quantity)||!integer(row.reorder_level,0,1e6)||!integer(row.menu_count)
  ||typeof row.is_active!=='boolean'||typeof row.low_stock!=='boolean'||row.low_stock!==(row.is_active&&row.quantity<=row.reorder_level)
  ||!timestamp(row.updated_at)||!(row.unit_cost===null||typeof row.unit_cost==='string'&&/^\d{1,8}(?:\.\d{1,6})?$/.test(row.unit_cost))))throw invalidResponse();
 return data;
}
export function packagingMenus(data){
 if(!Array.isArray(data)||!unique(data)||data.some(row=>!row||!identity(row.id)||!name(row.name)||!timestamp(row.updated_at)
  ||!['active','paused','archived'].includes(row.selling_status)||!Array.isArray(row.requirements)||row.requirements.length>30
  ||new Set(row.requirements.map(r=>r?.packaging_item)).size!==row.requirements.length
  ||row.requirements.some(r=>!r||!identity(r.packaging_item)||!integer(r.quantity_per_item,1,1000))))throw invalidResponse();
 return data;
}
export function packagingHistory(data){
 if(!Array.isArray(data?.results)||data.results.length>50||!unique(data.results)||data.results.some((row,i)=>!row||!identity(row.id)
  ||i>0&&row.id>=data.results[i-1].id||!['opening','receive','adjust','allocate','release'].includes(row.kind)
  ||!integer(row.balance_after)||!Number.isSafeInteger(row.change)||!integer(Math.abs(row.change))||!timestamp(row.created_at)
  ||typeof row.reason!=='string'||row.reason.length>500||!(row.order_id===null||identity(row.order_id)))
  ||!(data.next_before===null||data.results.length>0&&data.next_before===data.results.at(-1).id))throw invalidResponse();
 return data;
}
export function packagingChange(direction,quantity){
 const count=Number(quantity);
 if(!['receive','remove'].includes(direction)||String(quantity).trim()===''||!integer(count,1,1e6))throw new Error('Enter a whole number of pieces from 1 to 1,000,000.');
 return direction==='remove'?-count:count;
}
