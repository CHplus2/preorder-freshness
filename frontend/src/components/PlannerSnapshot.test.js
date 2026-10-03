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
  const {default:KitchenAvailability}=await server.ssrLoadModule('/src/components/KitchenAvailability.jsx');
  const availability=renderToStaticMarkup(createElement(KitchenAvailability));
  assert.match(availability,/Loading unavailable time/);
  assert.match(availability,/<fieldset disabled=""/);
  assert.doesNotMatch(availability,/No unavailable time recorded/);
  console.log('Planner snapshot: initial loading, refresh with cached data, failed refresh, missing response and ready state passed.');
} finally {await server.close();}
