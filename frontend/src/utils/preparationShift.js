// Shift saved tasks together, preserving their durations, pauses and overlaps.
export function shiftPreparation(tasks, malaysiaStart) {
 const starts=tasks.map(t=>Date.parse(t.start)),ends=tasks.map(t=>Date.parse(t.end));
 if(!tasks.length || starts.some((a,i)=>!Number.isFinite(a) || !Number.isFinite(ends[i]) || ends[i]<=a))return null;
 const target=Date.parse(malaysiaStart+':00+08:00');
 if(!Number.isFinite(target))return null;
 const offset=target-Math.min(...starts);
 return {start:new Date(target).toISOString(),end:new Date(Math.max(...ends)+offset).toISOString(),
  steps:starts.map((a,index)=>({index,start:new Date(a+offset).toISOString()}))};
}
