import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expiryStatus,inventoryAttention,inventoryCategory,inventoryRecords,materialRecords} from './inventoryAttention.js';
import {malaysiaDate} from './planner.js';
const today='2026-10-01';
const batch={id:1,quantity:'2.500',unit_cost:'4.000000',expiry_date:today};
test('date boundaries use explicit Malaysia day rather than device midnight',()=>{
 assert.equal(malaysiaDate('2026-09-30T16:01:00Z'),today);
 assert.equal(expiryStatus('2026-09-30',today),'expired');
 assert.equal(expiryStatus(today,today),'expiring');
 assert.equal(expiryStatus('2026-10-04',today),'expiring');
 assert.equal(expiryStatus('2026-10-05',today),'fresh');
 assert.equal(expiryStatus(null,today),'unknown');
});
test('held expired stock appears once and empty batches are excluded',()=>{
 const groups=inventoryAttention([{...batch,quarantined:true,expiry_date:'2026-09-30'},{...batch,id:2,quantity:'0'}],today);
 assert.equal(groups.find(g=>g.key==='held').rows.length,1);
 assert.equal(groups.reduce((n,g)=>n+g.rows.length,0),1);
});
test('stock value preserves zero cost and reports incomplete costs',()=>{
 const g=inventoryAttention([batch,{...batch,id:2,unit_cost:null},{...batch,id:3,unit_cost:'0'}],today).find(g=>g.key==='today');
 assert.equal(g.value,10);assert.equal(g.unknownCosts,1);
});
test('priority ranges do not overlap and rows sort without mutating input',()=>{
 const rows=[{...batch,id:4,expiry_date:'2026-10-04'},{...batch,id:2,expiry_date:'2026-10-02'},{...batch,id:3,expiry_date:null},batch];
 const groups=inventoryAttention(rows,today);
 assert.deepEqual(groups.find(g=>g.key==='soon').rows.map(r=>r.id),[2,4]);
 assert.equal(groups.find(g=>g.key==='unknown').rows.length,1);
 assert.equal(groups.find(g=>g.key==='today').rows.length,1);
 assert.equal(rows[0].id,4);
});


test('invalid calendar dates need review rather than rolling forward into usable shelf life',()=>{
 for(const expiry of ['2026-02-30','2026-04-31','2026-13-01','2026-00-01','not-a-date'])assert.equal(expiryStatus(expiry,today),'unknown');
 assert.equal(expiryStatus('2024-02-29','2024-02-28'),'expiring');
 assert.equal(inventoryCategory({...batch,quarantined:true},today),'held');
 assert.equal(inventoryCategory({...batch,quarantined:false},today),'expiring');
});
test('inventory reads keep malformed data out of stock counts and preserve genuine zero quantities',()=>{
 const row={...batch,raw_material:2,raw_material_name:'Rice',unit:'g',quarantined:false};
 assert.deepEqual(inventoryRecords([row]),[row]);assert.deepEqual(inventoryRecords([]),[]);
 assert.equal(inventoryRecords([{...row,quantity:'0.000'}])[0].quantity,'0.000');
 assert.deepEqual(materialRecords([{id:2,name:'Rice',unit:'g'}]),[{id:2,name:'Rice',unit:'g'}]);
 for(const value of [{results:null},[{...row,quantity:null}],[{...row,quantity:-1}],[{...row,quantity:'abc'}],[{...row,quarantined:'false'}],[{...row,expiry_date:123}],[{...row,raw_material:0}]])assert.throws(()=>inventoryRecords(value),error=>error.code==='INVALID_RESPONSE');
 assert.throws(()=>materialRecords([{id:2,unit:'g'}]),error=>error.code==='INVALID_RESPONSE');
});
