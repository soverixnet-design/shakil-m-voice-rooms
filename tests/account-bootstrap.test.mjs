import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadAccountProfile} from '../src/lib/accountBootstrapFlow.ts';
const url='https://shakil-m-voice-rooms.onrender.com';
test('profile bootstrap identifies token verification stalls before contacting server',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});let requested=false;
 const pending=loadAccountProfile({url,getToken:()=>new Promise(()=>{}),request:async()=>{requested=true}});
 const rejected=assert.rejects(pending,{code:'login/session-verification-failed'});
 t.mock.timers.tick(20000);await rejected;assert.equal(requested,false);
});
test('profile bootstrap distinguishes unreachable server and uses only token identity',async()=>{
 const stages=[];let requestBody;
 const data={id:'123',name:'Real User',coins:345,photoURL:'',role:'user'};
 const result=await loadAccountProfile({url,getToken:async()=> 'verified-token',onStage:s=>stages.push(s),request:async(_url,options)=>{requestBody=options;return new Response(JSON.stringify({data}))}});
 assert.deepEqual(result,data);assert.equal(requestBody.body,'{}');assert.equal(requestBody.headers.Authorization,'Bearer verified-token');assert.equal(stages.length,2);
 await assert.rejects(loadAccountProfile({url,getToken:async()=> 'token',pause:async()=>{},request:async()=>{throw new TypeError('Failed to fetch')}}),{code:'login/profile-server-unreachable'});
 await assert.rejects(loadAccountProfile({url,getToken:async()=> 'token',request:async()=>new Response(JSON.stringify({error:{code:'unauthenticated',message:'unauthenticated'}}),{status:401})}),{code:'login/unauthenticated'});
});
test('profile server stall ends with specific error and aborts pending fetch',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});let signal;
 const pending=loadAccountProfile({url,getToken:async()=> 'token',request:async(_url,options)=>{signal=options.signal;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'}))))}});
 const rejected=assert.rejects(pending,{code:'login/profile-server-timeout'});
 await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(75000);await rejected;assert.equal(signal.aborted,true);
});

test('saved login survives a cold profile server and retries only the same verified identity',async()=>{
 let calls=0;const identities=[];
 const data={id:'123',name:'Existing User',coins:100,photoURL:'',role:'user'};
 const result=await loadAccountProfile({url,getToken:async()=> 'saved-token',pause:async()=>{},request:async(_,options)=>{identities.push(options.headers.Authorization);if(++calls===1)return new Response('server waking',{status:503});return new Response(JSON.stringify({data}));}});
 assert.deepEqual(result,data);assert.equal(calls,2);assert.deepEqual(identities,['Bearer saved-token','Bearer saved-token']);
});
test('blocked accounts are not retried or replaced by cached profile data',async()=>{
 let calls=0;await assert.rejects(loadAccountProfile({url,getToken:async()=> 'saved-token',pause:async()=>{},request:async()=>{calls++;return new Response(JSON.stringify({error:{code:'permission-denied',message:'blocked-account'}}),{status:403});}}),/blocked-account/);assert.equal(calls,1);
});
