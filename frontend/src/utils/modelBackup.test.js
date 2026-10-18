import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {downloadModelBytes} from './modelBackup.js';

const content=new TextEncoder().encode('test-only-backup');
const checksum=createHash('sha256').update(content).digest('hex');
const headers={'Content-Type':'application/gzip','X-Checksum-SHA256':checksum};
let requested;
const result=await downloadModelBytes(async(path,options)=>{requested={path,options};return new Response(content,{headers});},webcrypto);
assert.equal(result.checksum,checksum);assert.deepEqual(new Uint8Array(result.bytes),content);
assert.equal(requested.path,'/api/admin/predictive/model-backup/');assert.equal(requested.options.credentials,'same-origin');
await assert.rejects(()=>downloadModelBytes(async()=>new Response(content,{headers:{...headers,'X-Checksum-SHA256':'0'.repeat(64)}}),webcrypto),/checksum did not match/);
await assert.rejects(()=>downloadModelBytes(async()=>new Response('{}',{headers:{'Content-Type':'application/json'}}),webcrypto),/could not be verified/);
await assert.rejects(()=>downloadModelBytes(async()=>new Response(null,{status:403}),webcrypto),/staff account/);
await assert.rejects(()=>downloadModelBytes(async()=>new Response(null,{status:503}),webcrypto),/does not contain a verified/);
console.log('Model backup download: staff session, valid bytes, integrity mismatch, invalid response and unavailable archive passed.');
