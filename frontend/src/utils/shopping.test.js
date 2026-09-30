import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shoppingList} from './shopping.js';
const row=(overrides={})=>({material_id:1,material:'Rice',unit:'g',quantity:'0.100',needed_by:'2026-10-01',order:1,...overrides});
test('combines shortages with exact three-place quantities and preserves orders',()=>{
 const result=shoppingList([row(),row({quantity:'0.200',order:2})],'2026-10-01');
 assert.equal(result[0].quantity,'0.300');assert.equal(result[0].requirements.length,2);
});
test('cutoff includes overdue needs and excludes future needs',()=>{
 const result=shoppingList([row(),row({needed_by:'2026-10-03'})],'2026-10-02');
 assert.equal(result[0].quantity,'0.100');
});
test('never combines different ingredients or units',()=>{
 assert.equal(shoppingList([row(),row({material_id:2}),row({unit:'kg'})],'2026-10-01').length,3);
});
test('orders shopping by earliest requirement',()=>{
 const result=shoppingList([row(),row({material_id:2,needed_by:'2026-09-30'})],'2026-10-01');
 assert.equal(result[0].earliest,'2026-09-30');assert.deepEqual(shoppingList([],'2026-10-01'),[]);
});
