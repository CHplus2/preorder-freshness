import test from 'node:test';
import assert from 'node:assert/strict';
import {apiError, readApiError} from './apiError.js';
test('nested validation stays readable',()=>{assert.equal(apiError({response:{status:400,data:{ingredients:[{quantity_required:['Must be positive.']}]}}}),'quantity required: Must be positive.');});
test('server failures do not expose internals',()=>{assert.ok(!apiError({response:{status:500,data:'<html>password secret</html>'}}).includes('secret'));});
test('session, timeout and network recovery',()=>{assert.match(apiError({response:{status:403,data:{detail:'CSRF Failed'}}}),/sign in again/);assert.match(apiError({code:'ECONNABORTED'}),/My orders/);assert.match(apiError({}),/connection/);});
test('non-JSON errors use fallback',()=>{assert.equal(apiError({response:{status:404,data:'<html>404</html>'}},'Not found.'),'Not found.');});
test('read-only failures give retry guidance without order submission instructions',()=>{
  for (const error of [{}, {code:'ECONNABORTED'}, {code:'INVALID_RESPONSE'}, {response:{status:503,data:{reference:'review-123',detail:'secret'}}}]) {
    const message=readApiError(error);
    assert.doesNotMatch(message,/My orders|submitted|secret/);
    assert.match(message,/try again/);
  }
  assert.match(readApiError({response:{status:503,data:{reference:'review-123'}}}),/Reference: review-123/);
});
test('read-only errors retain validation, authentication and safe fallback handling',()=>{
  assert.match(readApiError({response:{status:401}}),/sign in/);
  assert.match(readApiError({response:{status:429}}),/wait/);
  assert.equal(readApiError({response:{status:400,data:{start:['Choose a valid date.']}}}),'start: Choose a valid date.');
  assert.equal(readApiError({response:{status:404,data:'<html>private trace</html>'}},'Report not found.'),'Report not found.');
  assert.match(apiError({response:{status:503}}),/My orders/);
});
