import assert from 'node:assert/strict';
import test from 'node:test';
import {savedEscrows,saveEscrow} from './escrowRecovery.js';
const record={contract:'0x0000000000000000000000000000000000000001',id:'0x'+'1'.repeat(64),hash:'0x'+'2'.repeat(64),status:'pending'};
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};
test('public references survive reload, update in place and remain bounded',()=>{
 const s=storage();assert.equal(saveEscrow(record,s),true);assert.deepEqual(savedEscrows(s),[record]);
 saveEscrow({...record,extra:'must not be stored'},s);assert.deepEqual(savedEscrows(s),[record]);
 saveEscrow({...record,status:'confirmed'},s);assert.equal(savedEscrows(s).length,1);assert.equal(savedEscrows(s)[0].status,'confirmed');
 for(let i=3;i<18;i++)saveEscrow({...record,id:'0x'+i.toString(16).padStart(64,'0')},s);
 assert.equal(savedEscrows(s).length,10);
});
test('broken and unavailable browser storage do not block payment; invalid references never restore',()=>{
 const broken={getItem:()=>{throw Error('disabled')},setItem:()=>{throw Error('disabled')}};
 assert.deepEqual(savedEscrows(broken),[]);assert.equal(saveEscrow(record,broken),false);
 for(const row of [{...record,contract:'wrong'},{...record,id:'bad'},{...record,hash:'https://bad.test'},{...record,status:'paid'}])assert.equal(saveEscrow(row,storage()),false);
 assert.deepEqual(savedEscrows({getItem:()=>'{broken'}),[]);
});
