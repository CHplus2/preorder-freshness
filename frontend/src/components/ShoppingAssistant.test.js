import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Assistant}=await server.ssrLoadModule('/src/components/ShoppingAssistant.jsx');
 const {MemoryRouter}=await import('react-router-dom');
 const {AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.js');
 const {UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js');
 const {CartContext}=await server.ssrLoadModule('/src/contexts/CartContext.js');
 const render=(language,aiAvailable)=>renderToStaticMarkup(h(MemoryRouter,null,h(AuthContext.Provider,{value:{isAuthenticated:true}},h(UIContext.Provider,{value:{setShowLogin:()=>{}}},h(CartContext.Provider,{value:{cart:[],cartLoading:false,refreshCart:()=>{}}},h(Assistant,{language,aiAvailable}))))));
 const en=render('en',false);assert.match(en,/Choose one menu per addition/);assert.match(en,/Whole basket budget/);assert.match(en,/Lunch for six tomorrow/);
 assert.doesNotMatch(en,/Only this message is sent to Groq|AI-interpreted request|Confirm addition to basket|Test payment confirmed/);
 assert.match(render('en',true),/Only this message is sent to Groq/);
 assert.match(render('ms',false),/Rancang|rancang/);assert.match(render('zh',false),/安排您的订单/);
 console.log('Shopping UI: multilingual request controls, whole-basket budget, explicit scope and opt-in AI disclosure passed.');
}finally{await server.close()}
