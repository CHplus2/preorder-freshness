import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {default:PaymentOptions}=await server.ssrLoadModule('/src/components/PaymentOptions.jsx');
 const {default:PayPalPayment}=await server.ssrLoadModule('/src/components/PayPalPayment.jsx');
 const {MemoryRouter}=await import('react-router-dom');
 const options=enabled=>renderToStaticMarkup(createElement(MemoryRouter,null,createElement(PaymentOptions,{value:'cod',onChange:()=>{},paypalEnabled:enabled})));
 assert.doesNotMatch(options(false),/value="paypal"/);
 assert.match(options(true),/PayPal Sandbox/);assert.match(options(true),/No real money is transferred/);
 assert.match(options(true),/Cash on delivery/);assert.match(options(true),/Demo credit wallet/);
 const initial=renderToStaticMarkup(createElement(PayPalPayment,{orderId:147}));
 assert.match(initial,/Loading payment status/);assert.match(initial,/No real money is transferred/);
 assert.doesNotMatch(initial,/Test payment confirmed|server verified/);
 console.log('PayPal UI: configured-only selection, Sandbox labelling, loading state and no premature success passed.');
}finally{await server.close()}
