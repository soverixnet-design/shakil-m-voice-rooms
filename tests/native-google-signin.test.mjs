import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeGoogleToken} from '../src/lib/nativeGoogleSignIn.ts';
test('native Google handoff accepts only its pending request and preserves cancellation',async()=>{
 const target=new EventTarget();let id;
 target.EarnBDGoogleAuth={signIn:value=>{id=value}};
 const pending=nativeGoogleToken(target);
 target.dispatchEvent(new CustomEvent('earnbd-google-signin',{detail:{requestId:'other',token:'wrong'}}));
 target.dispatchEvent(new CustomEvent('earnbd-google-signin',{detail:{requestId:id,token:'test-google-token'}}));
 assert.equal(await pending,'test-google-token');
 const cancelled=nativeGoogleToken(target);
 target.dispatchEvent(new CustomEvent('earnbd-google-signin',{detail:{requestId:id,error:'auth/popup-closed-by-user'}}));
 await assert.rejects(cancelled,{code:'auth/popup-closed-by-user'});
});
test('older shells get a concrete update instruction',async()=>{await assert.rejects(nativeGoogleToken(new EventTarget()),{code:'native/update-required'})});
test('timeout cancels the native request and removes its response handler',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const target=new EventTarget();let id,cancelled;
 target.EarnBDGoogleAuth={signIn:value=>{id=value},cancel:value=>{cancelled=value}};
 const pending=nativeGoogleToken(target),check=assert.rejects(pending,{code:'account-timeout'});
 t.mock.timers.tick(120000);await check;assert.equal(cancelled,id);
});
