import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lockBodyScroll} from './bodyScrollLock.js';

// Minimal CSS declaration substitute; native CSS is also checked in Chromium.
function body() {
 const values = new Map();
 return {style: {
  getPropertyValue: name => values.get(name)?.value || '',
  getPropertyPriority: name => values.get(name)?.priority || '',
  setProperty(name,value,priority='') {
   for (const key of name==='overflow'?['overflow-x','overflow-y']:[name]) values.set(key,{value,priority});
  },
  removeProperty(name) {
   for (const key of name==='overflow'?['overflow-x','overflow-y']:[name]) values.delete(key);
  },
 }};
}
const axes = node => ['overflow-x','overflow-y'].map(name=>node.style.getPropertyValue(name));

test('overlapping dialogs retain their lock until the last closes, in either order',()=>{
 for (const order of [[0,1],[1,0]]) {
  const page=body(),release=[lockBodyScroll(page),lockBodyScroll(page)];
  release[order[0]]();assert.deepEqual(axes(page),['hidden','hidden']);
  release[order[1]]();assert.deepEqual(axes(page),['','']);
 }
});
test('duplicate cleanup cannot unlock another dialog or corrupt the next opening',()=>{
 const page=body(),first=lockBodyScroll(page),second=lockBodyScroll(page);
 first();first();assert.deepEqual(axes(page),['hidden','hidden']);second();
 const next=lockBodyScroll(page);second();assert.deepEqual(axes(page),['hidden','hidden']);next();
 assert.deepEqual(axes(page),['','']);
});
test('original per-axis scrolling and priorities are restored without changing other styles',()=>{
 const page=body();page.style.setProperty('overflow-x','hidden','important');page.style.setProperty('overflow-y','scroll');page.style.setProperty('color','green');
 const first=lockBodyScroll(page),second=lockBodyScroll(page);first();second();
 assert.deepEqual(axes(page),['hidden','scroll']);assert.equal(page.style.getPropertyPriority('overflow-x'),'important');assert.equal(page.style.getPropertyPriority('overflow-y'),'');assert.equal(page.style.getPropertyValue('color'),'green');
});
test('independent documents and StrictMode mount/cleanup cycles keep independent locks',()=>{
 const page=body(),other=body();lockBodyScroll(page)();
 const release=lockBodyScroll(page),releaseOther=lockBodyScroll(other);release();assert.deepEqual(axes(other),['hidden','hidden']);releaseOther();assert.deepEqual(axes(other),['','']);
});
