import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {default:MenuListingStatus}=await server.ssrLoadModule('/src/components/MenuListingStatus.jsx');
 const status=p=>renderToStaticMarkup(createElement(MenuListingStatus,p));
 assert.match(status({error:true,count:0,shown:0}),/temporarily unavailable/);
 assert.doesNotMatch(status({error:true,count:0,shown:0}),/0 items found/);
 assert.match(status({loading:true,count:0,shown:0}),/Loading menu/);
 assert.match(status({count:1,shown:1}),/1 item found/);
 const {default:PaymentOptions}=await server.ssrLoadModule('/src/components/PaymentOptions.jsx');
 const payment=p=>renderToStaticMarkup(createElement(MemoryRouter,null,createElement(PaymentOptions,{value:'cod',onChange:()=>{},...p})));
 const html=payment({manualEnabled:true});
 assert.match(html,/Cash on delivery/);assert.match(html,/DuitNow QR/);
 const demo=html.slice(html.indexOf('<details'));
 assert.match(demo,/Demo credit wallet/);assert.doesNotMatch(demo,/<details[^>]*\sopen/);
 assert.doesNotMatch(payment({manualEnabled:false}),/DuitNow QR/);
 assert.match(payment({value:'wallet'}),/demo wallet selected/);
 console.log('Product UX: loading/error counts, enabled payment options and collapsed demo disclosure passed.');
}finally{await server.close();}
