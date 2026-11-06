import assert from 'node:assert/strict';
import {helpCapabilities,helpAnswer} from './kitchenHelpResponse.js';
const capabilities={ai_available:false,languages:['en','ms','zh']};assert.equal(helpCapabilities(capabilities),capabilities);
for(const bad of [{...capabilities,ai_available:'false'},{...capabilities,languages:['en','en','ms']},null])assert.throws(()=>helpCapabilities(bad),{code:'INVALID_RESPONSE'});
const menu={name:'Chicken salad',price:'13.00',food_total:'39.00',portions:3,href:'/products/7'};
const answer={answer:'Choose your food, then confirm at checkout.',topic:'menu',mode:'guided',href:'/menu',menus:[menu]};assert.equal(helpAnswer(answer),answer);
for(const bad of [{...answer,href:'javascript:alert(1)'},{...answer,menus:[{...menu,href:'https://untrusted.test/products/7'}]},{...answer,menus:[{...menu,food_total:'13.00'}]},{...answer,menus:[menu,menu]},{...answer,menus:null},{...answer,topic:'delete_order'},{...answer,mode:'bank_verified'},{...answer,answer:' '},{...answer,menus:[null]}])assert.throws(()=>helpAnswer(bad),{code:'INVALID_RESPONSE'});
assert.equal(helpAnswer({...answer,answer:'<script>alert(1)</script>'}).answer,'<script>alert(1)</script>');
console.log('Kitchen guide: bounded answers, internal links, distinct modes and per-quantity totals passed.');
