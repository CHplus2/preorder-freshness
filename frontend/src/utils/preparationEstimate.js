const whole = (value, minimum) => value !== '' && value !== null && value !== undefined && Number.isSafeInteger(Number(value)) && Number(value)>=minimum;

export function preparationEstimate(menu, quantity, store={}) {
  if(!whole(quantity,1) || Number(quantity)>10000)return {error:'Enter a sample quantity from 1 to 10,000 portions.'};
  if(!whole(menu.batch_size ?? 1,1))return {error:'Enter a valid portions-per-batch value first.'};
  const portions=Number(quantity),size=Number(menu.batch_size ?? 1),batches=Math.ceil(portions/size);
  const detailed=!!menu.preparation_tasks?.length;
  const independent=detailed && !!menu.preparation_tasks[0].independent_batches;
  let steps;
  if(detailed) {
    if(menu.preparation_tasks.some(t=>!whole(t.minutes,1) || (!independent && !whole(t.additional_batch_minutes,0))))return {error:'Complete the step durations to calculate this preview.'};
    if(menu.preparation_tasks.some(t=>!!t.independent_batches!==independent))return {error:'Use the same batch mode for all steps.'};
    steps=menu.preparation_tasks.map(t=>({name:t.name || 'Unnamed step',worker:!!t.worker,overnight:!!t.overnight,
      uninterrupted:independent?Number(t.minutes):Number(t.minutes)+(batches-1)*Number(t.additional_batch_minutes),
      repetitions:independent?batches:1}));
  } else {
    const cook=menu.preparation_minutes ?? 60,extra=menu.additional_batch_minutes ?? 60,pack=menu.packing_minutes_per_portion ?? 1;
    if(!whole(cook,1) || !whole(extra,0) || !whole(pack,0))return {error:'Complete the basic cooking and packing estimates first.'};
    steps=[{name:'Cook',worker:true,overnight:false,uninterrupted:Number(cook)+(batches-1)*Number(extra),repetitions:1}];
    if(Number(pack)>0)steps.push({name:'Pack',worker:true,overnight:false,uninterrupted:portions*Number(pack),repetitions:1});
  }
  const total=steps.reduce((n,t)=>n+t.uninterrupted*t.repetitions,0);
  const handsOn=steps.filter(t=>t.worker).reduce((n,t)=>n+t.uninterrupted*t.repetitions,0);
  const hoursKnown=whole(store.kitchen_open_hour,0) && whole(store.kitchen_close_hour,1) && Number(store.kitchen_close_hour)>Number(store.kitchen_open_hour);
  const dailyMinutes=hoursKnown?(Number(store.kitchen_close_hour)-Number(store.kitchen_open_hour))*60:null;
  const warnings=[];
  if(handsOn===0)warnings.push('No step reserves worker time. Check whether setup, mixing, loading or packing needs an attended step.');
  if(independent && batches>100)warnings.push('This quantity exceeds the automatic planner’s limit of 100 independent batches per menu.');
  if(whole(menu.daily_capacity,1) && portions>Number(menu.daily_capacity))warnings.push('The sample quantity exceeds this menu’s daily portion limit, even before existing orders.');
  for(const t of steps)if(dailyMinutes!==null && !t.overnight && t.uninterrupted>dailyMinutes)warnings.push(`${t.name} requires ${t.uninterrupted} uninterrupted minutes; the kitchen day has ${dailyMinutes}. Review batch size, duration or batch mode.`);
  return {portions,batches,size,partial:portions%size,independent,detailed,steps,total,handsOn,dailyMinutes,warnings};
}
