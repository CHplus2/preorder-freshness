import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server = await createServer({server:{middlewareMode:true}, appType:'custom'});
try {
  const {default: AvailabilityResult} = await server.ssrLoadModule('/src/components/AvailabilityResult.jsx');
  const quote = {selectionKey:'basket-and-date', plan:{preparation_at:'2026-10-01T03:00:00Z', hands_on_minutes:30, procurement_required:false}};
  const render = props => renderToStaticMarkup(createElement(AvailabilityResult, {selectionKey:'basket-and-date', quote, ...props}));
  assert.match(render({}), /Your requested time is available/);
  assert.match(render({}), /continue to place your preorder/);
  assert.match(render({}), /stock is not reserved/);
  const multi=render({quote:{...quote,plan:{...quote.plan,daily_work:[
    {date:'2026-10-19',hands_on_minutes:490,pause_minutes:240,task_count:2},
    {date:'2026-10-20',hands_on_minutes:510,pause_minutes:480,task_count:2}]}}});
  assert.match(multi,/Preparation across 2 days/);assert.match(multi,/8h 10m hands-on/);
  assert.match(multi,/planned pause/);assert.match(multi,/Your requested time is available/);
  assert.match(render({quote:{...quote, plan:{...quote.plan, procurement_required:true}}}), /needs to purchase ingredients/);
  const manual=render({quote:{...quote,plan:{needs_review:true,preparation_at:null}}});
  assert.match(manual,/Kitchen confirmation needed/);
  assert.match(manual,/No payment will be taken/);
  assert.doesNotMatch(manual,/Your requested time is available|Preparation starts/);
  const stale = render({selectionKey:'changed-basket'});
  assert.match(stale, /Please check availability again/);
  assert.doesNotMatch(stale, /Your requested time is available/);
  assert.match(render({checking:true}), /Checking kitchen availability/);
  const failed = render({error:'No available slot for Granola Bar'});
  assert.match(failed, /No available slot for Granola Bar/);
  assert.doesNotMatch(failed, /Your requested time is available/);
  assert.doesNotMatch(render({quote:null}), /Your requested time is available/);
  const {default: BasketSlots} = await server.ssrLoadModule('/src/components/BasketSlots.jsx');
  const initialSlots=renderToStaticMarkup(createElement(BasketSlots,{value:'',onSelect:()=>{}}));
  assert.doesNotMatch(initialSlots,/No hourly slots found|Suggest times for this basket|Find the next available day|Search later dates/);
  assert.equal((initialSlots.match(/Find delivery times/g) || []).length,1);
  const {default: RecipeEditor} = await server.ssrLoadModule('/src/components/RecipeEditor.jsx');
  const flexible=renderToStaticMarkup(createElement(RecipeEditor,{value:{max_early_minutes:0,max_preparation_days:2},onChange:()=>{}}));
  assert.match(flexible,/Flexible on the dispatch day/);assert.match(flexible,/Completed food does not occupy the worker/);
  assert.doesNotMatch(flexible,/finish exactly|Zero early finish|May finish up to/);
  const limited=renderToStaticMarkup(createElement(RecipeEditor,{value:{max_early_minutes:120,max_preparation_days:2},onChange:()=>{}}));
  assert.match(limited,/May finish up to/);
  console.log('Availability result: success, procurement, stale selection, pending, failure and initial state passed.');
} finally {
  await server.close();
}
