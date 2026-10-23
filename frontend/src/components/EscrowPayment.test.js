import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Page}=await server.ssrLoadModule('/src/pages/customer/EscrowDemoPage.jsx');
 const html=renderToStaticMarkup(h(MemoryRouter,null,h(Page)));
 for(const text of ['Escrow payment','Sepolia · Test network','no monetary value','does not pay for a food order','Connect your wallet','Fund escrow','Escrow reference','Withdraw funds'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/>Testnet escrow<|>Demo ID<|>Lock test coins<|>Lock coins as the buyer</);
 console.log('Escrow payment: normal action labels, explicit network/checkout boundary and disconnected state passed.');
}finally{await server.close();}
