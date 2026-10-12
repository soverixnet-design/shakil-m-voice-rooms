import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadAccountProfile} from '../src/lib/accountBootstrapFlow.ts';
const url='https://shakil-m-voice-rooms.onrender.com';
test('profile bootstrap identifies token verification stalls before contacting server',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let requested=false;
 const pending=loadAccountProfile({url,getToken:()=>new Promise(()=>{}),request:async()=>{requested=true}});
 const rejected=assert.rejects(pending,{code:'login/session-verification-failed'});
 t.mock.timers.tick(8000);await rejected;assert.equal(requested,false);
});
test('profile bootstrap distinguishes unreachable server and uses only token identity',async()=>{
 const stages=[];let requestBody;
 const data={id:'123',name:'Real User',coins:345,photoURL:'',role:'user'};
 const result=await loadAccountProfile({url,getToken:async()=> 'verified-token',onStage:s=>stages.push(s),request:async(_url,options)=>{requestBody=options;return new Response(JSON.stringify({data}))}});
 assert.deepEqual(result,data);assert.equal(requestBody.body,'{}');assert.equal(requestBody.headers.Authorization,'Bearer verified-token');assert.equal(stages.length,2);
 await assert.rejects(loadAccountProfile({url,getToken:async()=> 'token',request:async()=>{throw new TypeError('Failed to fetch')}}),{code:'login/profile-server-unreachable'});
 await assert.rejects(loadAccountProfile({url,getToken:async()=> 'token',request:async()=>new Response(JSON.stringify({error:{code:'unauthenticated',message:'unauthenticated'}}),{status:401})}),{code:'login/unauthenticated'});
});
test('profile server stall ends with specific error and aborts pending fetch',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;
 const pending=loadAccountProfile({url,getToken:async()=> 'token',request:async(_url,options)=>{signal=options.signal;return new Promise(()=>{})}});
 const rejected=assert.rejects(pending,{code:'login/profile-server-timeout'});
 await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(20000);await rejected;assert.equal(signal.aborted,true);
});
