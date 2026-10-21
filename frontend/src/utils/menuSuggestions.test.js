import assert from 'node:assert/strict';
import {menuSuggestions} from './menuSuggestions.js';
const row={id:1,name:'Rice meal',image_url:'',price:'12.00',reasons:['Popular recently']};
const response={session:'local-session',basis:'popularity',results:[row]};
assert.equal(menuSuggestions(response),response);
assert.deepEqual(menuSuggestions({...response,results:[]}).results,[]);
for(const data of [null,{}, {...response,basis:'guessed'}, {...response,results:[null]}, {...response,results:[row,row]}, {...response,results:[{...row,price:'NaN'}]}, {...response,results:[{...row,reasons:[]}]}, {...response,results:[{...row,name:''}]}, {...response,results:Array.from({length:4},(_,i)=>({...row,id:i+1}))}])assert.throws(()=>menuSuggestions(data),{code:'INVALID_RESPONSE'});
console.log('Menu suggestions: bounded identities, evidence labels, valid prices and distinct empty/error states passed.');
