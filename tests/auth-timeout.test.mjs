import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTimeout} from '../src/lib/authTimeout.ts';
test('stalled account database releases the login progress with a retryable timeout',async()=>{
  await assert.rejects(withTimeout(new Promise(()=>{}),15),{code:'account-timeout'});
});
test('confirmed account result and Firebase error survive timeout wrapper',async()=>{
  assert.equal(await withTimeout(Promise.resolve('confirmed'),100),'confirmed');
  await assert.rejects(withTimeout(Promise.reject(Object.assign(new Error('denied'),{code:'permission-denied'})),100),{code:'permission-denied'});
});
