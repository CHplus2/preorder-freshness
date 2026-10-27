import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {changeExpiryBasis,expiryPreview} from '../utils/expiryEvidence.js';
const stored={received_date:'2026-10-27',expiry_basis:'storage',shelf_life_days:10};
assert.deepEqual(expiryPreview(stored),{base:'2026-11-06',effective:'2026-11-06'});
assert.equal(expiryPreview({...stored,original_expiry_date:'2026-10-30',opened_date:'2026-10-27',after_open_days:1}).effective,'2026-10-28');
assert.equal(expiryPreview({...stored,expiry_basis:'manufactured',manufactured_date:'2026-10-25',shelf_life_days:3}).base,'2026-10-28');
assert.equal(expiryPreview({...stored,received_date:'2024-02-28',shelf_life_days:2}).base,'2024-03-01');
for(const fields of [{received_date:'2026-02-30'},{shelf_life_days:2147483647},{opened_date:'2026-10-27'},{original_expiry_date:'2026-10-26'},{expiry_basis:'manufactured',manufactured_date:'2026-10-28'}])assert.equal(expiryPreview({...stored,...fields}),null);
const labelled={received_date:'2026-10-27',expiry_date:'2026-10-30'};
assert.equal(changeExpiryBasis(labelled,'storage').original_expiry_date,'2026-10-30');
assert.equal(changeExpiryBasis({...stored,expiry_date:'2026-11-06'},'label').expiry_date,'');
assert.equal(expiryPreview({...stored,opened_date:'2026-10-28',after_open_days:1},'2026-10-27'),null);
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Fields}=await server.ssrLoadModule('/src/components/ExpiryFields.jsx');
 const render=value=>renderToStaticMarkup(createElement(Fields,{value,onChange:()=>{}}));
 const storage=render(stored),label=render(labelled),manufacture=render({...stored,expiry_basis:'manufactured'});
 assert.match(storage,/No manufacturing date is needed/);assert.doesNotMatch(storage,/<label[^>]*>Manufacture date</);
 assert.match(storage,/Documented storage life from receipt/);assert.doesNotMatch(storage,/<label[^>]*>Printed expiry \/ best-before date</);
 assert.match(storage,/Also have a printed expiry\? \(optional\)/);assert.match(storage,/FoodSafety.gov cold food storage chart/);
 assert.match(label,/<label[^>]*>Printed expiry \/ best-before date</);assert.doesNotMatch(label,/<label[^>]*>Documented shelf life from manufacture/);
 assert.match(manufacture,/<label[^>]*>Manufacture date</);assert.match(manufacture,/Documented shelf life from manufacture/);
 assert.match(storage,/not measure physical freshness/);
 assert.match(render({...stored,handling_history:'unknown'}),/<input[^>]*type="checkbox"[^>]*disabled=""[^>]*checked=""/);
 console.log('Expiry evidence: relevant mode fields, source reference, date anchors, printed/opened caps, leap years and conservative mode changes passed.');
}finally{await server.close();}
