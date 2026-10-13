import test from 'node:test';import assert from 'node:assert/strict';
import {requestJson} from '../src/lib/resilientRequest.ts';
import {retryableVoiceConnection} from '../src/lib/voiceConnection.ts';
import {createGameHttpServer} from '../functions/http-server.js';
test('failed voice join can restart and concurrent mic requests share one connection',async()=>{
 let calls=0;const c=retryableVoiceConnection(async()=>{calls++;if(calls===1)throw Error('cold-server');});
 await assert.rejects(c.start(),/cold-server/);await Promise.all([c.start(),c.start()]);await c.start();assert.equal(calls,2);c.reset();await c.start();assert.equal(calls,3);
});
test('uncertain gift request retries identical receipt ID after connection loss',async()=>{
 const bodies=[];let calls=0;const body=JSON.stringify({requestId:'gift-stable-id',quantity:5});
 const result=await requestJson('https://test/api/gift',{method:'POST',body},{retryable:true,pause:async()=>{},request:async(_,opts)=>{bodies.push(opts.body);if(++calls===1)throw new TypeError('lost-response');return new Response(JSON.stringify({data:{balance:123}}));}});
 assert.equal(result.data.balance,123);assert.deepEqual(bodies,[body,body]);
});
test('unprotected writes and definite denied bets never repeat; transient rollback can retry',async()=>{
 let calls=0;const denied=async()=>{calls++;return new Response(JSON.stringify({error:{code:'failed-precondition',message:'bet-closed'}}),{status:409})};
 await assert.rejects(requestJson('test',{}, {retryable:true,pause:async()=>{},request:denied}),/bet-closed/);assert.equal(calls,1);
 await assert.rejects(requestJson('test',{}, {request:async()=>{calls++;throw new TypeError('lost')}}),/lost/);assert.equal(calls,2);
 let retries=0;assert.deepEqual(await requestJson('test',{}, {retryable:true,pause:async()=>{},request:async()=>++retries===1?new Response(JSON.stringify({error:{code:'aborted',message:'transaction-conflict'}}),{status:409}):new Response(JSON.stringify({data:{ok:true}}))}),{data:{ok:true}});assert.equal(retries,2);
});
test('voice renewal budget is isolated from bet and gift budget; serialization conflicts are retryable',async()=>{
 const server=createGameHttpServer({service:{voiceConfig:async()=>({provider:'agora'}),gift:async()=>({ok:true}),bet:async()=>{throw Object.assign(Error('conflict'),{code:'40001'})}},verifyToken:async()=>({uid:'user'}),origins:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port,opts={method:'POST',headers:{Authorization:'Bearer '+'x'.repeat(24),'Content-Type':'application/json'},body:'{}'};
 try{for(let i=0;i<120;i++)assert.equal((await fetch(url+'/api/voice-config',opts)).status,200);assert.equal((await fetch(url+'/api/gift',opts)).status,200);const response=await fetch(url+'/api/bet',opts);assert.equal(response.status,409);assert.equal((await response.json()).error.code,'aborted');}finally{await new Promise(r=>server.close(r));}
});
