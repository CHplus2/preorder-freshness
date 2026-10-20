import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyWork,planningReadiness,duration} from './planner.js';
import {plannerCalendar} from './plannerCalendar.js';
test('fractional work minutes round without displaying 60 minutes',()=>{assert.equal(duration(119.9),'2h 0m');assert.equal(duration(60.1),'1h 0m')});
const date='2026-09-20';
const task=(start,end,worker=true)=>({name:'Task',start:date+'T'+start+':00+08:00',end:date+'T'+end+':00+08:00',worker,resource:worker?'stove':'fridge'});
const plan=tasks=>({availability:{open_hour:8,close_hour:16,blocks:[]},orders:[{id:1,status:'pending',items:[],preparation_plan:{tasks}}]});
test('delivery requests remain visible separately from scheduled deliveries and calendar exports',()=>{
 const p=plan([task('09:00','10:00')]);p.orders[0].delivery_at=date+'T12:00:00+08:00';
 const request={id:147,status:'pending',items:[],delivery_at:date+'T16:00:00+08:00',preparation_plan:{needs_review:true,tasks:[]}};
 p.orders.push(request);
 const day=dailyWork(p,date);
 assert.deepEqual(day.deliveries.map(o=>o.id),[1]);assert.deepEqual(day.requests.map(o=>o.id),[147]);
 assert.equal(day.handsMinutes,60);
 const calendar=plannerCalendar(p.orders,new Date('2026-09-19T12:00:00Z'));
 assert.equal(calendar.events,2);assert.equal(calendar.invalidTasks,0);
 assert.match(calendar.content,/DTSTART:20260920T010000Z/);
 assert.match(calendar.content,/UID:1-delivery@dapur-kita/);
 assert.doesNotMatch(calendar.content,/147|Invalid Date/);
 assert.equal(plannerCalendar([request]).events,0);
});
test('calendar excludes old preparation for ready orders and survives invalid saved tasks',()=>{
 const p=plan([task('09:00','10:00'),{start:'bad',end:'bad'},task('12:00','11:00')]);
 p.orders[0].delivery_at=date+'T16:00:00+08:00';
 const original=JSON.stringify(p);
 const calendar=plannerCalendar(p.orders);
 assert.equal(calendar.events,2);assert.equal(calendar.invalidTasks,2);
 assert.equal(JSON.stringify(p),original);
 p.orders[0].status='cooked';const ready=plannerCalendar(p.orders);
 assert.equal(ready.events,1);assert.doesNotMatch(ready.content,/Prepare order/);
 p.orders[0].status='cancelled';assert.equal(plannerCalendar(p.orders).events,0);
});
test('hands-on time excludes unattended equipment use',()=>{const d=dailyWork(plan([task('09:00','10:00'),task('09:00','13:00',false)]),date);assert.equal(d.handsMinutes,60);assert.equal(d.availableMinutes,480);assert.equal(d.tasks.length,2);assert.equal(d.conflictingMinutes,0)});
test('multiday resting appears on each occupied day',()=>{const p=plan([{...task('09:00','10:00',false),start:'2026-09-19T18:00:00+08:00',end:'2026-09-21T10:00:00+08:00'}]);assert.equal(dailyWork(p,date).tasks[0].dayMinutes,1440)});
test('overlapping closures are not double counted',()=>{const p=plan([]);p.availability.blocks=[task('10:00','12:00'),task('11:00','13:00')].map(t=>({start_at:t.start,end_at:t.end}));assert.equal(dailyWork(p,date).availableMinutes,300)});
test('legacy overlap is flagged and never fabricated into recipe steps',()=>{const p=plan([task('10:00','12:00'),task('11:00','13:00')]);assert.equal(dailyWork(p,date).conflictingMinutes,60);p.orders[0].preparation_plan={};p.orders[0].preparation_at=date+'T10:00:00+08:00';p.orders[0].preparation_end_at=date+'T11:00:00+08:00';const d=dailyWork(p,date);assert.equal(d.unscheduled.length,1);assert.equal(d.tasks[0].legacy,true)});
test('cooked orders do not reserve future hands-on work',()=>{const p=plan([task('10:00','12:00')]);p.orders[0].status='cooked';assert.equal(dailyWork(p,date).handsMinutes,0)});
test('changed hours flag previously accepted early work',()=>{const p=plan([task('09:00','10:00')]);p.availability.open_hour=10;assert.equal(dailyWork(p,date).outsideHoursMinutes,60)});

test('unattended equipment conflicts are detected without worker conflicts',()=>{
 const p=plan([task('09:00','11:00',false),task('10:00','12:00',false),task('10:30','11:30',false)]);
 const d=dailyWork(p,date);assert.equal(d.equipmentConflictMinutes,90);assert.equal(d.conflictingMinutes,0);
 assert.ok(d.tasks.every(t=>t.equipmentConflict));assert.equal(p.orders[0].preparation_plan.tasks[0].equipmentConflict,undefined);
});
test('different equipment, no equipment and touching endpoints remain valid',()=>{
 const p=plan([task('09:00','10:00',false),{...task('09:00','10:00',false),resource:'oven'},task('10:00','11:00',false),{...task('09:00','11:00',false),resource:'none'},{...task('09:00','11:00',false),resource:'none'}]);
 assert.equal(dailyWork(p,date).equipmentConflictMinutes,0);
});
test('closures include unattended work outside hours and union overlapping intervals',()=>{
 const p=plan([task('06:00','10:00',false),task('07:00','09:00',false)]);
 p.availability.blocks=[{start_at:date+'T06:30:00+08:00',end_at:date+'T08:00:00+08:00'},{start_at:date+'T07:00:00+08:00',end_at:date+'T09:00:00+08:00'}];
 const d=dailyWork(p,date);assert.equal(d.closureConflictMinutes,150);assert.ok(d.tasks.every(t=>t.closureConflict));
});
test('legacy whole-kitchen reservations conflict with unattended equipment',()=>{
 const p=plan([{...task('09:00','11:00'),resource:'all'},task('10:00','12:00',false)]);
 assert.equal(dailyWork(p,date).equipmentConflictMinutes,60);
 p.orders[0].status='cooked';assert.equal(dailyWork(p,date).equipmentConflictMinutes,0);
});

test('conflict details identify both orders and worker-only overlap',()=>{
 const p=plan([task('09:00','11:00')]);
 p.orders.push({id:21,status:'processing',items:[],preparation_plan:{tasks:[{...task('10:00','12:00'),resource:'prep_table',name:'Mix batter'}]}});
 const d=dailyWork(p,date);
 assert.equal(d.tasks[0].conflicts[0].orderId,21);assert.equal(d.tasks[0].conflicts[0].name,'Mix batter');
 assert.equal(d.tasks[0].conflicts[0].kind,'Worker');assert.equal(d.tasks[1].conflicts[0].orderId,1);
 assert.equal((d.tasks[0].conflicts[0].end-d.tasks[0].conflicts[0].start)/60000,60);
});
test('closure details preserve the reason and clip overlap to selected day',()=>{
 const p=plan([{...task('01:00','02:00',false),start:'2026-09-19T23:00:00+08:00'}]);
 p.availability.blocks=[{reason:'Fridge maintenance',start_at:'2026-09-19T22:00:00+08:00',end_at:date+'T01:00:00+08:00'}];
 const c=dailyWork(p,date).tasks[0].conflicts[0];assert.equal(c.name,'Fridge maintenance');assert.equal(c.kind,'closure');
 assert.equal(c.start,Date.parse(date+'T00:00:00+08:00'));assert.equal((c.end-c.start)/60000,60);
});

test('readiness separates missing dates and overdue records from actionable upcoming plans',()=>{
 const now=Date.parse('2026-10-17T12:00:00+08:00');
 const pending=(id,delivery_at,extra={})=>({id,status:'pending',delivery_at,preparation_plan:{},...extra});
 const rows=[pending(1,null),pending(2,'bad-date'),pending(3,'2026-10-16T12:00:00+08:00'),
  pending(4,'2026-10-24T18:00:00+08:00',{preparation_plan:{needs_review:true,tasks:[]}}),
  pending(5,'2026-10-24T18:00:00+08:00',{status:'processing'}),
  pending(6,'2026-10-24T18:00:00+08:00',{inventory_deducted:true}),
  pending(7,'2026-10-24T18:00:00+08:00',{preparation_plan:{tasks:[{name:'Manual reservation',start:'2026-10-24T14:00:00+08:00',end:'2026-10-24T16:30:00+08:00'}]}}),
  pending(8,null,{status:'delivered'}),pending(9,null,{status:'cancelled'})];
 const before=JSON.stringify(rows), groups=planningReadiness(rows,now);
 assert.deepEqual(groups.missingDelivery.map(o=>o.id),[1,2]);
 assert.deepEqual(groups.overdue.map(o=>o.id),[3]);
 assert.deepEqual(groups.needsPlan.map(o=>o.id),[4]);
 assert.deepEqual(groups.started.map(o=>o.id),[5,6]);
 assert.equal(JSON.stringify(rows),before);
});

test('readiness compares actual delivery instants and keeps incomplete plans under review',()=>{
 const now=Date.parse('2026-10-17T12:00:00+08:00');
 const rows=[{id:1,status:'pending',delivery_at:'2026-10-17T04:00:00Z',preparation_plan:{}},
  {id:2,status:'pending',delivery_at:'2026-10-17T04:01:00Z',preparation_plan:{needs_review:true,tasks:[{name:'Unconfirmed'}]}}];
 const groups=planningReadiness(rows,now);
 assert.deepEqual(groups.overdue.map(o=>o.id),[1]);
 assert.deepEqual(groups.needsPlan.map(o=>o.id),[2]);
});

test('saved tasks do not hide an open order with no delivery date',()=>{
 const groups=planningReadiness([{id:11,status:'pending',delivery_at:null,preparation_plan:{tasks:[{name:'Old task'}]}}]);
 assert.deepEqual(groups.missingDelivery.map(o=>o.id),[11]);
});

test('saved tasks cannot hide overdue deliveries, pre-order preparation or missed pending work',()=>{
 const now=Date.parse('2026-10-18T12:00:00+08:00');
 const order=(id,delivery,created,start,end,status='pending')=>({id,status,delivery_at:delivery,created_at:created,preparation_plan:{tasks:[{name:'Cook',start,end}]}});
 const rows=[order(1,'2026-10-17T18:00:00+08:00','2026-10-16T12:00:00+08:00','2026-10-17T14:00:00+08:00','2026-10-17T16:30:00+08:00'),
  order(2,'2026-10-20T18:00:00+08:00','2026-10-18T10:00:00+08:00','2026-10-17T14:00:00+08:00','2026-10-17T16:30:00+08:00'),
  order(3,'2026-10-18T18:00:00+08:00','2026-10-17T10:00:00+08:00','2026-10-18T11:00:00+08:00','2026-10-18T16:30:00+08:00'),
  order(4,'2026-10-18T18:00:00+08:00','2026-10-17T10:00:00+08:00','2026-10-18T11:00:00+08:00','2026-10-18T16:30:00+08:00','processing')];
 const before=JSON.stringify(rows),groups=planningReadiness(rows,now);
 assert.deepEqual(groups.overdue.map(o=>o.id),[1]);
 assert.deepEqual(groups.needsPlan.map(o=>o.id),[2,3]);
 assert.deepEqual(groups.started,[]);
 assert.equal(JSON.stringify(rows),before);
});
