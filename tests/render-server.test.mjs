import test from 'node:test';import assert from 'node:assert/strict';
import {createGameHttpServer} from '../functions/http-server.js';
const token='a'.repeat(30),origin='https://earnbd.work';
const body={game:'greedy_lion',roundId:'123',index:0,amount:1000,requestId:'test-request-123456'};
test('Render transport checks origin/auth/input and takes UID only from verified token',async()=>{
 const calls=[],service={sync:async(g,u)=>{calls.push(['sync',g,u]);return {id:'123'}},bet:async(d,u)=>{calls.push(['bet',d,u]);return {amount:d.amount}}};
 const server=createGameHttpServer({service,verifyToken:async t=>{if(t!==token)throw Error('bad-token');return {uid:'verified-user'}},origins:[origin]});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(data,headers={},path='/api/bet')=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(data)});
 try{assert.equal((await fetch(base+'/health')).status,200);const pre=await fetch(base+'/api/bet',{method:'OPTIONS',headers:{Origin:origin}});assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),origin);
 assert.equal((await post(body,{Origin:'https://attacker.example'})).status,403);assert.equal((await post(body,{Authorization:''})).status,401);assert.equal((await post(body,{Authorization:'Bearer '+'b'.repeat(30)})).status,401);assert.equal((await post(body,{'Content-Type':'text/plain'})).status,400);assert.equal((await post([])).status,400);assert.equal(calls.length,0);
 const ok=await post({...body,uid:'victim'});assert.equal(ok.status,200);assert.equal((await ok.json()).data.amount,1000);assert.equal(calls[0][2],'verified-user');const sync=await post({game:'greedy_lion'}, {}, '/api/sync');assert.equal(sync.status,200);assert.deepEqual(calls[1],['sync','greedy_lion','verified-user']);
 service.bet=async()=>{throw Error('bet-closed')};const closed=await post(body);assert.equal(closed.status,409);assert.equal((await closed.json()).error.code,'failed-precondition');
 const missing=await fetch(base+'/missing');assert.equal(missing.status,404);
 }finally{await new Promise(r=>server.close(r))}
});
test('missing server credentials reports setup-required and never accepts bets',async()=>{let called=false;const server=createGameHttpServer({service:{bet:()=>{called=true}},verifyToken:async()=>({uid:'x'}),origins:[origin],ready:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;try{assert.equal((await fetch(base+'/health')).status,503);assert.equal((await fetch(base+'/api/bet',{method:'POST'})).status,503);assert.equal(called,false)}finally{await new Promise(r=>server.close(r))}});
test('health verifies database readiness and caches quota/permission diagnostics without leaking data',async()=>{for(const [code,reason] of [[8,'database-quota-exceeded'],[7,'server-database-permission-denied']]){let calls=0;const server=createGameHttpServer({service:{},verifyToken:async()=>({uid:'u'}),origins:[origin],checkReady:async()=>{calls++;throw Object.assign(Error('private database detail'),{code})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base=`http://127.0.0.1:${server.address().port}`;for(let i=0;i<2;i++){const r=await fetch(base+'/health');assert.equal(r.status,code===8?200:503);const body=await r.json();assert.equal(body.reason,reason);assert.equal(body.status,'database-unavailable');assert(!JSON.stringify(body).includes('private database detail'));}assert.equal(calls,1)}finally{await new Promise(r=>server.close(r))}}});

test('account bootstrap trusts verified identity and rejects unsigned callers',async()=>{
 let received;const identity={uid:'real-user',email:'owner@example.com',email_verified:true};
 const server=createGameHttpServer({service:{account:async(data,verified)=>{received=verified;return {id:'123',role:'user'}}},verifyToken:async()=>identity,origins:[origin]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}/api/account`;
 const request={method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({uid:'victim',email:'yfastvpn@gmail.com',role:'admin'})};
 assert.equal((await fetch(base,{...request,headers:{...request.headers,Authorization:''}})).status,401);
 const response=await fetch(base,request);assert.equal(response.status,200);assert.deepEqual(received,identity);assert.equal((await response.json()).data.role,'user');
 }finally{await new Promise(r=>server.close(r))}
});

test('API recovers after an expired quota diagnostic without a health-page visit',async t=>{
 let now=Date.now(),unavailable=true,calls=0;
 t.mock.method(Date,'now',()=>now);
 const server=createGameHttpServer({service:{sync:async()=>{calls++;return {id:'recovered'}}},verifyToken:async()=>({uid:'u'}),origins:[origin],checkReady:async()=>{if(unavailable)throw Object.assign(Error('quota'),{code:8})}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;
 await fetch(base+'/health');
 const request={method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({game:'greedy_lion'})};
 assert.equal((await fetch(base+'/api/sync',request)).status,503);assert.equal(calls,0);
 unavailable=false;now+=30001;
 assert.equal((await fetch(base+'/api/sync',request)).status,200);assert.equal(calls,1);
 }finally{await new Promise(r=>server.close(r))}
});

test('live social polling does not consume the separate account-action request budget',async()=>{
 const server=createGameHttpServer({service:{social:async()=>[],account:async()=>({id:'123',name:'User'})},verifyToken:async()=>({uid:'viewer'}),origins:[origin]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;
 const request={method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'query'})};
 for(let i=0;i<130;i++)assert.equal((await fetch(base+'/api/social',request)).status,200);
 assert.equal((await fetch(base+'/api/account',request)).status,200);
 }finally{await new Promise(r=>server.close(r))}
});
