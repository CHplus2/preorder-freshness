const dayNumber = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? Date.parse(`${date}T00:00:00Z`)/86400000 : NaN;
export function expiryStatus(expiry, today) {
  const days=dayNumber(expiry)-dayNumber(today);
  return !Number.isFinite(days)?'unknown':days<0?'expired':days<=3?'expiring':'fresh';
}

export function inventoryAttention(items,today) {
  const groups={held:[],expired:[],today:[],soon:[],unknown:[]};
  for(const item of items) {
    if(!(Number(item.quantity)>0))continue;
    const days=dayNumber(item.expiry_date)-dayNumber(today);
    // Mutually exclusive priorities prevent the same batch/value being counted twice.
    const category=item.quarantined?'held':!Number.isFinite(days)?'unknown':days<0?'expired':days===0?'today':days<=3?'soon':null;
    if(category)groups[category].push({...item,days});
  }
  return Object.entries(groups).map(([key,rows])=>{
    rows.sort((a,b)=>(a.expiry_date || '9999').localeCompare(b.expiry_date || '9999') || a.id-b.id);
    let value=0,unknownCosts=0;
    for(const row of rows) {
      const cost=row.unit_cost;
      if(cost===null || cost===undefined || cost==='' || !Number.isFinite(Number(cost)) || Number(cost)<0)unknownCosts++;
      else value+=Number(row.quantity)*Number(cost);
    }
    return {key,rows,value,unknownCosts};
  });
}
