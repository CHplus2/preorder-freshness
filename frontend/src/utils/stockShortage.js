// Treat API error details as untrusted data, just like successful responses.
export function stockShortage(data){
 const packaging=data?.code==='packaging_stock_shortage';
 if(!packaging&&data?.code!=='ingredient_stock_shortage')return null;
 const id=packaging?'packaging_item_id':'raw_material_id';
 const rows=data.shortages;
 if(!Array.isArray(rows)||!rows.length||rows.length>100)return null;
 const number=value=>typeof value==='string'&&/^\d+(?:\.\d{1,3})?$/.test(value)&&Number.isFinite(Number(value));
 if(new Set(rows.map(r=>r?.[id])).size!==rows.length)return null;
 if(rows.some(r=>!r||!/^\d+$/.test(r[id])||!Number.isSafeInteger(Number(r[id]))||Number(r[id])<1||typeof r.name!=='string'||!r.name.trim()||r.name.length>200||typeof r.unit!=='string'||r.unit.length>20||!['required','available','shortfall'].every(k=>number(r[k]))||packaging&&(r.unit!=='pieces'||!['required','available','shortfall'].every(k=>Number.isSafeInteger(Number(r[k]))))||Number(r.required)<=Number(r.available)||Math.abs(Number(r.shortfall)-(Number(r.required)-Number(r.available)))>.00001))return null;
 return {kind:packaging?'packaging':'ingredient',rows,count:Number.isSafeInteger(Number(data.shortage_count))&&Number(data.shortage_count)>=rows.length?Number(data.shortage_count):rows.length};
}
export const stockQuantity=value=>new Intl.NumberFormat('en-MY',{maximumFractionDigits:3}).format(Number(value));
