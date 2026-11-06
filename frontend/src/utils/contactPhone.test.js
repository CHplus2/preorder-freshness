import assert from 'node:assert/strict';
import {contactPhone} from './contactPhone.js';
for(const phone of ['01112345678','011 1234 5678','011-1234-5678','+60 11 1234 5678','601112345678']){
 assert.deepEqual(contactPhone(phone),{number:'+601112345678',error:''});
}
for(const phone of ['0123456789','012 345 6789','+60123456789','+60 12 345 6789'])assert.equal(contactPhone(phone).number,'+60123456789');
assert.match(contactPhone('011').error,/full number.*prefix/);
assert.equal(contactPhone('011').number,'');
for(const phone of ['', 'abc', '+01112345678', '+1234567890123456'])assert.ok(contactPhone(phone).error);
console.log('Contact phone: complete local/international numbers accepted; incomplete prefixes rejected with guidance.');
