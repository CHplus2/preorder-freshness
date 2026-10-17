import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {default:StockFlowEvidence}=await server.ssrLoadModule('/src/features/predictive/StockFlowEvidence.jsx');
 const flow={opening_quantity:5400,confirmed_allocated:0,forecast_consumed:4870.986,
  projected_total_remaining:529.014,projected_expiring_unused:196.891,projected_carried_stock:332.123,
  batches:[{batch_id:1,expiry_date:'2026-10-19',after_confirmed:1800,forecast_consumed:1603.109,
   projected_remaining:196.891,expires_in_window:true,unit_cost:.006},
   {batch_id:2,expiry_date:'2026-10-31',after_confirmed:3600,forecast_consumed:3267.877,
    projected_remaining:332.123,expires_in_window:false,unit_cost:null}]};
 const render=risk=>renderToStaticMarkup(createElement(StockFlowEvidence,{risk,window:{end_date:'2026-10-23'}}));
 const risk={unit:'g',forecast_requirement:4870.986,forecast_shortfall:0,forecast_expiring_unused:196.891,stock_flow:flow};
 const html=render(risk);
 for(const value of ['529.014 g remaining','196.891','332.123','Unknown'])assert.ok(html.includes(value),value);
 assert.match(html,/Projected waste within this window/);
 assert.match(html,/Carried beyond this window/);
 assert.match(html,/no stock deducted/);
 assert.match(render({...risk,forecast_expiring_unused:0}),/zero projected waste can coexist with a shortage/);
 assert.match(render({...risk,stock_flow:undefined}),/Stock dated later carries forward/);
 console.log('Stock flow: expiry waste, carried stock, total balance, unknown cost and zero-waste explanation passed.');
} finally {await server.close();}
