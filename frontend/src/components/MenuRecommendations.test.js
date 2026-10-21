import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Card}=await server.ssrLoadModule('/src/components/MenuRecommendationCard.jsx');
 const {default:Recommendations}=await server.ssrLoadModule('/src/components/MenuRecommendations.jsx');
 const {default:Guide}=await server.ssrLoadModule('/src/components/GuidedMenu.jsx');
 const {AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.js'),{CartContext}=await server.ssrLoadModule('/src/contexts/CartContext.js'),{UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js'),{ProductContext}=await server.ssrLoadModule('/src/contexts/ProductContext.js');
 const render=component=>renderToStaticMarkup(h(MemoryRouter,null,h(AuthContext.Provider,{value:{isAuthenticated:false}},h(CartContext.Provider,{value:{cart:[]}},h(ProductContext.Provider,{value:{categories:[]}},h(UIContext.Provider,{value:{formatPrice:value=>'RM '+Number(value).toFixed(2)}},component))))));
 const initial=render(h(Recommendations));assert.match(initial,/Recommended for you/);assert.match(initial,/Refine for my date/);assert.match(initial,/Finding a few suggestions/);assert.doesNotMatch(initial,/No suggestions are available/);
 const card=render(h(Card,{menu:{id:4,name:'Rice meal',image_url:'',reasons:['Popular recently']},priceLabel:'RM 12.00 each'},h('button',null,'Add 1')));assert.match(card,/Photo coming soon/);assert.match(card,/\/products\/4/);assert.match(card,/Popular recently/);assert.match(card,/RM 12.00 each/);
 const guide=render(h(Guide));assert.match(guide,/Find food for your date/);assert.match(guide,/Refine your recommendations/);assert.match(guide,/Find my options/);assert.doesNotMatch(guide,/class="guide-results"/);
 console.log('Recommendation UI: visible entry point, loading distinction, shared evidence/photo cards and optional date refinement passed.');
}finally{await server.close();}
