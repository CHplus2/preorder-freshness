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
  assert.doesNotMatch(renderToStaticMarkup(createElement(BasketSlots, {value:'', onSelect:()=>{}})), /No hourly slots found/);
  console.log('Availability result: success, procurement, stale selection, pending, failure and initial state passed.');
} finally {
  await server.close();
}
