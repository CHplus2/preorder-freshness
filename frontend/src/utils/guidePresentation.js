export function guideDateBounds(now=new Date()){
 const first=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const last=new Date(first+'T12:00:00Z');last.setUTCDate(last.getUTCDate()+90);
 return {first,last:last.toISOString().slice(0,10)};
}
export function guideEmptyMessage(reason,category){
 const subject=category && category!=='Any category'?category+' menus':'Menus';
 if(reason==='category_unavailable')return `No ${category || 'matching'} menus are currently available for this search. Search all categories or browse the menu.`;
 if(reason==='no_kitchen_times')return `No automatic kitchen times were found for these ${category && category!=='Any category'?category+' menus':'menus'} on your date. Try a later date, fewer portions or another category.`;
 return `${subject} do not match these preferences. Try another date, a larger food budget, fewer portions or another category.`;
}
