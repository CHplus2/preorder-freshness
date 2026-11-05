import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:StockReadiness}=await server.ssrLoadModule('/src/components/StockReadiness.jsx');
 const {AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.js');
 const render=disabled=>renderToStaticMarkup(h(MemoryRouter,null,h(AuthContext.Provider,{value:{isSessionCurrent:()=>true}},h(StockReadiness,{today:'2026-11-05',onAddIngredient:()=>{},disabled}))));
 const html=render(false);assert.match(html,/Check ingredients &amp; packaging/);assert.match(html,/does not add stock or reserve orders/);assert.match(html,/Units of each offered menu/);assert.match(html,/max="2027-02-03"/);assert.match(html,/max="100"/);
 assert.doesNotMatch(html,/Recorded stock covers|Stock to replenish|Download stock worksheet/);
 assert.match(render(true),/<button disabled="" type="submit">Check stock/);
 console.log('Stock check UI: honest read-only entry, bounded date/quantity and no invented availability before loading passed.');
}finally{await server.close()}
