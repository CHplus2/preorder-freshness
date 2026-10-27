import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountRequestError,accountConfirmation,resetCredentials} from './accountForms.js';

test('account actions describe their own uncertain outcomes without order-submission guidance',()=>{
 for(const error of [{},{code:'ECONNABORTED'},{code:'INVALID_RESPONSE'},{response:{status:503,data:{detail:'private trace'}}}]){
  for(const action of ['signin','signup','reset','recovery','logout'])assert.doesNotMatch(accountRequestError(error,action),/My orders|submitted an order|private trace/);
  assert.match(accountRequestError(error,'signup'),/Try signing in/);
  assert.match(accountRequestError(error,'reset'),/new password/);
  assert.match(accountRequestError(error,'recovery'),/Check your email/);
 }
 assert.match(accountRequestError({response:{status:400,data:{password:['Avoid common passwords.']}}},'signup'),/Password: Avoid common/);
 assert.match(accountRequestError({response:{status:429}}),/wait/);
});
test('malformed success bodies cannot report a completed password update',()=>{
 assert.equal(accountConfirmation({detail:'Password updated.'}),'Password updated.');
 for(const data of [null,{},[],{detail:''},{detail:'<html>error</html>'}])assert.throws(()=>accountConfirmation(data),{code:'INVALID_RESPONSE'});
});
test('reset-fragment parsing is repeatable and distinguishes absent from incomplete links',()=>{
 const hash='#uid=abc&token=def-123';
 assert.deepEqual(resetCredentials(hash),{uid:'abc',token:'def-123'});
 assert.deepEqual(resetCredentials(hash),resetCredentials(hash));
 assert.deepEqual(resetCredentials(),{uid:null,token:null});
 assert.deepEqual(resetCredentials('#uid=abc'),{uid:'abc',token:null});
});

test('credential failures guide sign-in rather than asking an anonymous customer to sign in again',()=>{
 const error={response:{status:401,data:{detail:'untrusted account candidate'}}};
 assert.match(accountRequestError(error,'signin'),/email or username/);
 assert.match(accountRequestError(error,'signin'),/existing username/);
 assert.doesNotMatch(accountRequestError(error,'signin'),/Please sign in again|untrusted account/);
});
