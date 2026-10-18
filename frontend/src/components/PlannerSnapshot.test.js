import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {default:PlannerSnapshot}=await server.ssrLoadModule('/src/components/PlannerSnapshot.jsx');
  const render=props=>renderToStaticMarkup(createElement(PlannerSnapshot,{hasPlan:true,loadedAt:'2026-10-03T01:00:00Z',onRetry:()=>{},...props},createElement('button',null,'Export calendar')));
  for (const props of [{loading:true,hasPlan:false},{loading:true},{error:'Network unavailable'},{hasPlan:false}]) {
    const html=render(props);
    assert.doesNotMatch(html,/<button[^>]*>Export calendar/);
    assert.doesNotMatch(html,/No recorded shortfalls|No preparation scheduled|No outstanding orders/);
  }
  assert.match(render({loading:true}),/role="status"/);
  assert.match(render({error:'Network unavailable'}),/Network unavailable/);
  assert.match(render({error:'Network unavailable'}),/Retry loading plan/);
  const ready=render({});
  assert.match(ready,/<button>Export calendar<\/button>/);
  assert.match(ready,/Plan loaded/);
  assert.match(ready,/Malaysia/);
  const {MemoryRouter}=await import('react-router-dom');
  const {default:PlannerSetup}=await server.ssrLoadModule('/src/components/PlannerSetup.jsx');
  const setup=(orders,menus=[])=>renderToStaticMarkup(createElement(MemoryRouter,null,createElement(PlannerSetup,{orders,menus,now:Date.parse('2026-10-17T12:00:00+08:00'),onReview:()=>{}})));
  const oldRecords=setup([{id:1,status:'pending',delivery_at:null,preparation_plan:{}},{id:2,status:'pending',delivery_at:'2026-10-10T12:00:00+08:00',preparation_plan:{}}]);
  assert.match(oldRecords,/Cooking steps ready/);
  assert.match(oldRecords,/1 delivery date needs review/);
  assert.match(oldRecords,/1 past-due order needs follow-up/);
  assert.doesNotMatch(oldRecords,/upcoming order needs|Plan upcoming orders/);
  assert.match(oldRecords,/source=local/);
  assert.ok(oldRecords.includes('href="/admin/orders?review=missing-delivery"'));
  assert.match(oldRecords,/These records are not completed sales/);
  const upcoming=setup([{id:28,status:'pending',delivery_at:'2026-10-24T18:00:00+08:00',preparation_plan:{needs_review:true}}],[{id:20,name:'Active rice'}]);
  assert.match(upcoming,/1 active menu needs preparation steps/);
  assert.match(upcoming,/1 upcoming order needs preparation review/);
  assert.match(upcoming,/Plan upcoming orders/);
  const corrupted=setup([{id:32,status:'pending',created_at:'2026-10-17T10:00:00+08:00',delivery_at:'2026-10-24T18:00:00+08:00',preparation_plan:{tasks:[{start:'2026-10-16T14:00:00+08:00',end:'2026-10-16T16:00:00+08:00'}]}}]);
  assert.match(corrupted,/starts before this order was placed/);
  assert.match(corrupted,/1 upcoming order needs preparation review/);
  const {default:PlanTimingNotice}=await server.ssrLoadModule('/src/components/PlanTimingNotice.jsx');
  const demo=renderToStaticMarkup(createElement(PlanTimingNotice,{order:{preparation_plan:{fictional_timing:{allowances:[{menu:'Nasi Ayam',maximum_early_finish_minutes:120}]}}}}));
  assert.match(demo,/Demo timing/);assert.match(demo,/not verified food holding/);assert.match(demo,/2h 0m/);
  assert.match(demo,/<details class="plan-demo-assumptions"><summary>/);assert.doesNotMatch(demo,/<details[^>]*open/);
  const {default:PlannerOrderCard}=await server.ssrLoadModule('/src/components/PlannerOrderCard.jsx');
  const card=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(PlannerOrderCard,{now:Date.parse('2026-10-18T17:11:00+08:00'),onSaved:()=>{},order:{id:4,status:'pending',created_at:'2026-04-17T08:24:31+08:00',delivery_at:'2026-10-19T18:00:00+08:00',preparation_at:'2026-10-18T16:40:00+08:00',items:[{product_name:'Nasi Ayam Kicap',quantity:1}],preparation_plan:{tasks:[{name:'Prep',resource:'prep_table',menu:'Nasi Ayam Kicap',start:'2026-10-18T16:40:00+08:00',end:'2026-10-18T17:40:00+08:00',worker:true}]}}})));
  for(const label of ['Order #4','Not started','Nasi Ayam Kicap','Review preparation timing','Hands-on work','Equipment &amp; pauses','Start to finish','href="/admin/orders?order=4"'])assert.ok(card.includes(label),label);
  assert.doesNotMatch(card,/ORDER #4 \/ pending|Step time:|8:24:31/);
  const {default:GeneratedHistoryCard}=await server.ssrLoadModule('/src/components/GeneratedHistoryCard.jsx');
  const history=renderToStaticMarkup(createElement(GeneratedHistoryCard,{reference:'ORD-00146',order:{delivery_at:'2026-10-16T12:00:00+08:00',total_amount:'491.50',items:[{product_name:'Nasi Lemak Telur',quantity:4}]}}));
  for(const label of ['Demo data','No customer payment or delivery occurred','Scenario sales total','491.50','4 portions','View menu quantities'])assert.ok(history.includes(label),label);
  assert.doesNotMatch(history,/freshcast_synthetic_history_v1|Edit order|Payment records|payment-paid|status-delivered/);
  const {default:PreparationDays}=await server.ssrLoadModule('/src/components/PreparationDays.jsx');
  const days=renderToStaticMarkup(createElement(PreparationDays,{plan:{daily_work:[
    {date:'2026-10-19',hands_on_minutes:490,pause_minutes:240},
    {date:'2026-10-20',hands_on_minutes:510,pause_minutes:480}]}}));
  assert.match(days,/Preparation across 2 days/);assert.match(days,/8h 10m hands-on/);
  assert.equal(renderToStaticMarkup(createElement(PreparationDays,{plan:{daily_work:[{date:'2026-10-19'}]}})),'');
  const {default:PreparationTasks}=await server.ssrLoadModule('/src/components/PreparationTasks.jsx');
  const editor=renderToStaticMarkup(createElement(PreparationTasks,{value:{preparation_tasks:[{name:'Prep',resource:'prep_table',worker:true,minutes:1000,splittable:true,max_pause_minutes:720,pause_resource:'fridge'}]},onChange:()=>{}}));
  assert.match(editor,/Allow this preparation work to pause and resume/);assert.match(editor,/Maximum pause between work sessions/);assert.match(editor,/Fridge space/);
  assert.match(editor,/value="720"/);
  const {default:TaskConflicts}=await server.ssrLoadModule('/src/components/TaskConflicts.jsx');
  const conflictHtml=renderToStaticMarkup(createElement(TaskConflicts,{onReview:()=>{},conflicts:[{kind:'Worker',name:'Mix batter',orderId:21,start:Date.parse('2026-10-03T10:00:00+08:00'),end:Date.parse('2026-10-03T11:00:00+08:00')}]}));
  for(const value of ['Mix batter','Review order #21','10:00','11:00','Worker'])assert.ok(conflictHtml.includes(value));
  assert.equal(renderToStaticMarkup(createElement(TaskConflicts,{conflicts:[]})),'');
  const {default:KitchenAvailability}=await server.ssrLoadModule('/src/components/KitchenAvailability.jsx');
  const availability=renderToStaticMarkup(createElement(KitchenAvailability));
  assert.match(availability,/Loading unavailable time/);
  assert.match(availability,/<fieldset disabled=""/);
  assert.doesNotMatch(availability,/No unavailable time recorded/);
  const {default:ShoppingSheet}=await server.ssrLoadModule('/src/components/ShoppingSheet.jsx');
  const sheet=renderToStaticMarkup(createElement(ShoppingSheet,{through:'2026-10-10',missingRecipes:true,loadedAt:'2026-10-03T01:00:00Z',groups:[{key:'1:g',material:'Rice',quantity:'300.000',unit:'g',earliest:'2026-10-08',requirements:[{needed_by:'2026-10-08',order:21,quantity:'300.000'}]}]}));
  for(const text of ['INCOMPLETE','Rice','300.000','2026-10-08','order #21','Plan loaded','Paper ticks do not change the app'])assert.ok(sheet.includes(text),text);
  console.log('Planner snapshot: initial loading, refresh with cached data, failed refresh, missing response and ready state passed.');
} finally {await server.close();}
