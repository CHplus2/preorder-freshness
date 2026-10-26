import test from 'node:test';
import assert from 'node:assert/strict';
import {menuFieldErrors,menuSaveError} from './menuForm.js';
const valid={name:'Fixture meal',price:'12.50',category:2};
test('required menu fields give direct field messages and trim whitespace',()=>{
 assert.deepEqual(menuFieldErrors(valid),{});
 assert.deepEqual(menuFieldErrors({name:' ',price:'',category:''}),{name:'Enter a menu name.',price:'Enter a price.',category:'Choose a category.'});
 assert.deepEqual(menuFieldErrors({...valid,price:'0.01'}),{});
 for(const value of ['0','-1','bad','1.001','100000000'])assert.ok(menuFieldErrors({...valid,price:value}).price);
 assert.ok(menuFieldErrors({...valid,category:'invalid'}).category);
});
test('API field errors stay field-specific without raw serializer jargon',()=>{
 const result=menuSaveError({response:{status:400,data:{price:['A valid number is required.'],category:['Incorrect type. Expected pk value, received str.']}}});
 assert.deepEqual(Object.keys(result.fields),['price','category']);assert.equal(result.message,'Check the highlighted fields.');assert.equal(result.uncertain,false);
 assert.doesNotMatch(JSON.stringify(result),/pk value|received str/);
});
test('unknown save outcomes prevent blind duplicate creation; unrelated API errors retain useful explanations',()=>{
 for(const e of [{},{response:{status:503}}]){const result=menuSaveError(e);assert.equal(result.uncertain,true);assert.match(result.message,/check the menu list/);}
 assert.match(menuSaveError({response:{status:403,data:{detail:'CSRF verification failed'}}}).message,/session could not be verified/);
 assert.match(menuSaveError({response:{status:400,data:{ingredients:[{}]}}}).message,/recipe ingredients/);
});
