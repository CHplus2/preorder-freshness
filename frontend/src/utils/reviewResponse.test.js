import assert from 'node:assert/strict';
import {reviewPage} from './reviewResponse.js';
const row={id:4,rating:5,comment:'A real meal experience',customer:'fixture-customer'};
assert.deepEqual(reviewPage([row],'4'),{rows:[row],before:'4'});
assert.deepEqual(reviewPage([]),{rows:[],before:null});
for(const [rows,cursor] of [[{},null],[[{...row,rating:6}],null],[[row],'3'],[[],'1'],[Array(21).fill(row),null],[[{...row,comment:{html:'unsafe'}}],null]])assert.throws(()=>reviewPage(rows,cursor));
console.log('Review pagination: bounded arrays, next cursor matching, empty pages and invalid data passed.');
