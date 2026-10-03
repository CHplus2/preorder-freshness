import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyWork} from './planner.js';
const date='2026-09-20';
const task=(start,end,worker=true)=>({name:'Task',start:date+'T'+start+':00+08:00',end:date+'T'+end+':00+08:00',worker,resource:worker?'stove':'fridge'});
const plan=tasks=>({availability:{open_hour:8,close_hour:16,blocks:[]},orders:[{id:1,status:'pending',items:[],preparation_plan:{tasks}}]});
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
