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
 const initial=render(h(Recommendations));assert.match(initial,/Recommended for you/);assert.match(initial,/Get suggestions for a date/);assert.match(initial,/Finding a few suggestions/);assert.doesNotMatch(initial,/No suggestions are available/);
 const card=render(h(Card,{menu:{id:4,name:'Rice meal',image_url:'',reasons:['Popular recently']},priceLabel:'RM 12.00 each'},h('button',null,'Add 1')));assert.match(card,/Photo coming soon/);assert.match(card,/\/products\/4/);assert.match(card,/Popular recently/);assert.match(card,/RM 12.00 each/);
 const guide=render(h(Guide));assert.match(guide,/Menu suggestions for your date/);assert.match(guide,/Get up to three menu suggestions/);assert.match(guide,/Find my options/);assert.doesNotMatch(guide,/class="guide-results"/);
 const {default:Catalogue}=await server.ssrLoadModule('/src/components/MenuCatalogue.jsx');
 const menus=Array.from({length:12},(_,index)=>({id:index+1,name:`Browse meal ${index+1}`,price:12,lead_hours:24,daily_capacity:50,delivery_weekdays:[]}));
 const catalogue=render(h(Catalogue,{menus,recommendations:h('div',null,'SUPPORTING_SUGGESTIONS')}));
 assert.ok(catalogue.indexOf('Browse meal 8')<catalogue.indexOf('SUPPORTING_SUGGESTIONS'));
 assert.ok(catalogue.indexOf('SUPPORTING_SUGGESTIONS')<catalogue.indexOf('Browse meal 9'));
 assert.doesNotMatch(render(h(Catalogue,{menus,recommendations:null})),/SUPPORTING_SUGGESTIONS|menu-recommendations-inset/);
 const compact=render(h(Card,{compact:true,maxReasons:1,menu:{id:4,name:'Rice meal',image_url:'',reasons:['Reason one','Reason two']},priceLabel:'RM 12.00 each'}));
 assert.match(compact,/menu-recommendation-card--compact/);assert.match(compact,/Reason one/);assert.doesNotMatch(compact,/Reason two/);
 assert.match(guide,/1–100 selling units/);assert.match(guide,/max="100"/);assert.match(guide,/max="99999999.99"/);
 console.log('Recommendation UI: visible entry point, loading distinction, shared evidence/photo cards and optional date refinement passed.');
}finally{await server.close();}
