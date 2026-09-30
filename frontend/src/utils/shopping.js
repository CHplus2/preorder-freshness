// Quantities use three decimal places in the inventory model.
export function shoppingList(rows, through) {
  const groups = new Map();
  for (const row of rows.filter(r=>r.needed_by<=through)) {
    const key = `${row.material_id ?? row.material}:${row.unit}`;
    if (!groups.has(key)) groups.set(key,{key,material:row.material,unit:row.unit,milli:0,requirements:[]});
    const group=groups.get(key);
    group.milli+=Math.round(Number(row.quantity)*1000);
    group.requirements.push(row);
  }
  return [...groups.values()].map(g=>({...g,quantity:(g.milli/1000).toFixed(3),
    earliest:g.requirements.map(r=>r.needed_by).sort()[0]}))
    .sort((a,b)=>a.earliest.localeCompare(b.earliest)||a.material.localeCompare(b.material));
}
