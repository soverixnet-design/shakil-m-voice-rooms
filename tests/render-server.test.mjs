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
