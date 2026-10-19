import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {default:PaymentOptions}=await server.ssrLoadModule('/src/components/PaymentOptions.jsx');
 const {default:PayPalPayment}=await server.ssrLoadModule('/src/components/PayPalPayment.jsx');
 const {default:PayPalRecovery}=await server.ssrLoadModule('/src/components/PayPalRecovery.jsx');
 const {MemoryRouter}=await import('react-router-dom');
 const options=enabled=>renderToStaticMarkup(createElement(MemoryRouter,null,createElement(PaymentOptions,{value:'cod',onChange:()=>{},paypalEnabled:enabled})));
 assert.doesNotMatch(options(false),/value="paypal"/);
 assert.match(options(true),/PayPal Sandbox/);assert.match(options(true),/No real money is transferred/);
 assert.match(options(true),/Cash on delivery/);assert.match(options(true),/Demo credit wallet/);
 const initial=renderToStaticMarkup(createElement(PayPalPayment,{orderId:147}));
 assert.match(initial,/Loading payment status/);assert.match(initial,/No real money is transferred/);
 assert.doesNotMatch(initial,/Test payment confirmed|server verified/);
 const recovery={configured:true,has_provider_order:true,state:'created',checked_at:null,checked_via:null,check_error:null};
 const panel=(patch={},paymentStatus='unpaid',busy=false)=>renderToStaticMarkup(createElement(PayPalRecovery,{recovery:{...recovery,...patch},paymentStatus,busy,onCheck:()=>{}}));
 assert.match(panel(),/Check PayPal status/);assert.match(panel(),/does not charge/);assert.doesNotMatch(panel(),/Test payment confirmed/);
 assert.doesNotMatch(panel({has_provider_order:false}),/>Check PayPal status</);assert.match(panel({has_provider_order:false}),/not started/);
 assert.doesNotMatch(panel({configured:false}),/>Check PayPal status</);assert.match(panel({configured:false}),/currently unavailable/);
 assert.doesNotMatch(panel({},'refunded'),/>Check PayPal status</);
 assert.match(panel({},'unpaid',true),/disabled=""/);
 assert.match(panel({checked_at:'2026-10-19T10:00:00Z',checked_via:'notification'}),/PayPal notification/);
 assert.match(panel({check_error:'provider_unavailable'}),/latest check needs follow-up/);
 console.log('PayPal UI: configured-only selection, Sandbox labelling, loading state and no premature success passed.');
}finally{await server.close()}
