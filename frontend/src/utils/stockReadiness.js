import {invalidResponse} from './apiResponse.js';
const id=n=>Number.isSafeInteger(n)&&n>0;
const name=n=>typeof n==='string'&&n.trim().length>0&&n.length<=300;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const quant=n=>typeof n==='string'&&/^\d{1,12}\.\d{3}$/.test(n)&&Number.isSafeInteger(Number(n.replace('.','')));
const thousand=n=>Number(n.replace('.',''));
const list=rows=>Array.isArray(rows)&&rows.length<=20000&&new Set(rows.map(r=>r?.id)).size===rows.length;
export function stockReadiness(data,date,quantity){
 if(!data||data.date!==date||data.quantity_per_menu!==quantity||!['covered','shortages','review','no_menus'].includes(data.state)
  ||!Number.isFinite(Date.parse(data.checked_at))||!list(data.menus)||!list(data.excluded_menus)||!list(data.issues)||!list(data.ingredients)||!list(data.packaging)
  ||data.menus.some(r=>!id(r.id)||!name(r.name)||r.units!==quantity)
  ||data.excluded_menus.some(r=>!id(r.id)||!name(r.name))||data.issues.some(r=>!id(r.id)||!name(r.name)||!name(r.detail))
  ||data.ingredients.some(r=>!id(r.id)||!name(r.name)||!['g','kg','ml','l','unit'].includes(r.unit)||!quant(r.required)||thousand(r.required)<=0||!quant(r.available)||!quant(r.shortfall)||thousand(r.shortfall)!==Math.max(0,thousand(r.required)-thousand(r.available))||!id(r.menu_count))
  ||data.packaging.some(r=>!id(r.id)||!name(r.name)||!id(r.required)||!integer(r.available)||!integer(r.shortfall)||r.shortfall!==Math.max(0,r.required-r.available)||typeof r.is_active!=='boolean'||!id(r.menu_count)))throw invalidResponse();
 const state=data.issues.length||data.packaging.some(r=>!r.is_active)?'review':data.ingredients.some(r=>thousand(r.shortfall)>0)||data.packaging.some(r=>r.shortfall>0)?'shortages':data.menus.length?'covered':'no_menus';
 if(data.state!==state)throw invalidResponse();
 return data;
}
export function stockWorksheet(data){
 const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
 const rows=[['Planning date','Type','Ingredient or packaging','Unit','Target quantity','Recorded available','Shortfall','Actually received','Received date','Expiry / planning deadline','Storage location','Source / evidence']];
 for(const [kind,list] of [['Ingredient',data.ingredients],['Packaging',data.packaging]])for(const row of list)rows.push([data.date,kind,row.name,row.unit||'pieces',row.required,row.available,row.shortfall,'','','','','']);
 return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
