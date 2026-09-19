import test from 'node:test';
import assert from 'node:assert/strict';
import {apiError} from './apiError.js';
test('nested validation stays readable',()=>{assert.equal(apiError({response:{status:400,data:{ingredients:[{quantity_required:['Must be positive.']}]}}}),'quantity required: Must be positive.');});
test('server failures do not expose internals',()=>{assert.ok(!apiError({response:{status:500,data:'<html>password secret</html>'}}).includes('secret'));});
test('session, timeout and network recovery',()=>{assert.match(apiError({response:{status:403,data:{detail:'CSRF Failed'}}}),/sign in again/);assert.match(apiError({code:'ECONNABORTED'}),/My orders/);assert.match(apiError({}),/connection/);});
test('non-JSON errors use fallback',()=>{assert.equal(apiError({response:{status:404,data:'<html>404</html>'}},'Not found.'),'Not found.');});
