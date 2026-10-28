import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceStagingHttpServer} from '../functions/voice-staging-http.js';

const env={
 LIVEKIT_ENABLED:'true',LIVEKIT_URL:'wss://voice.example.test',
 LIVEKIT_API_KEY:'key_12345',LIVEKIT_API_SECRET:'s'.repeat(40),
 LIVEKIT_MINUTES_BUDGET:'90',ALLOWED_ORIGINS:'https://allowed.example.test'
};
const validToken='signed_firebase_test_token_12345';
function fixture(){
 const rows=new Map([
  ['users/alice',{currentRoomId:'room-one',roomSeat:0}],
  ['users/bob',{currentRoomId:'room-one',roomSeat:null}],
  ['rooms/room-one',{sc:8,voiceProvider:'livekit'}]
 ]);
 let writes=0;
 const database={doc:path=>({get:async()=>({data:()=>rows.get(path)}),set:()=>{writes++;throw Error('unexpected-write');}})};
 const verifyIdToken=async token=>token===validToken?{uid:'alice'}:token===validToken+'bob'?{uid:'bob'}:Promise.reject(Error('invalid-token'));
 const server=createVoiceStagingHttpServer({database,verifyIdToken,env});
 return {rows,server,getWrites:()=>writes};
}
async function withServer(fn){
 const f=fixture();
 await new Promise(resolve=>f.server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+f.server.address().port;
 try{return await fn(f,url);}finally{await new Promise(resolve=>f.server.close(resolve));}
}
const post=(url,token,roomId='room-one')=>fetch(url+'/api/voice-config',{
 method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
 body:JSON.stringify({roomId})
});
test('staging exposes only health and authenticated voice, never game/wallet actions',async()=>{
 await withServer(async(f,url)=>{
  const health=await (await fetch(url+'/health')).json();
  assert.equal(health.mode,'voice-only-staging');
  assert.equal(health.firestoreWrites,false);
  assert.equal(health.livekitPrimaryForUnassignedRooms,false);
  assert.equal((await fetch(url+'/api/bet',{method:'POST'})).status,404);
  assert.equal((await fetch(url+'/api/gift',{method:'POST'})).status,404);
  assert.equal((await fetch(url+'/api/voice-config',{method:'POST'})).status,401);
  assert.equal(f.getWrites(),0);
 });
});
test('only Firebase-authenticated room members can obtain separate Akira-safe tokens',async()=>{
 await withServer(async(f,url)=>{
  assert.equal((await post(url,'wrongwrongwrongwrongwrong')).status,401);
  const signed=await post(url,validToken);
  assert.equal(signed.status,200);
  const result=(await signed.json()).data;
  assert.equal(result.provider,'livekit');
  assert.equal(result.canPublish,true);
  assert.match(result.channel,/^shakilm-[0-9a-f]{48}$/);
  assert.equal(result.staging,true);
  f.rows.get('users/alice').currentRoomId='another-room';
  assert.equal((await post(url,validToken)).status,403);
  assert.equal(f.getWrites(),0);
 });
});
test('listeners cannot publish, muted or blocked members cannot get speaker grants',async()=>{
 await withServer(async(f,url)=>{
  const listener=await post(url,validToken+'bob');
  assert.equal(listener.status,200);
  assert.equal((await listener.json()).data.canPublish,false);
  f.rows.set('rooms/room-one/controls/alice',{muted:true});
  const muted=await post(url,validToken);
  assert.equal((await muted.json()).data.canPublish,false);
  f.rows.set('rooms/room-one/controls/alice',{blocked:true});
  assert.equal((await post(url,validToken)).status,403);
  assert.equal(f.getWrites(),0);
 });
});
test('unapproved browser origins are rejected even with a token',async()=>{
 await withServer(async(f,url)=>{
  const denied=await fetch(url+'/api/voice-config',{method:'POST',
   headers:{Origin:'https://evil.example.test','Content-Type':'application/json',Authorization:'Bearer '+validToken},
   body:JSON.stringify({roomId:'room-one'})});
  assert.equal(denied.status,403);
  assert.equal(f.getWrites(),0);
 });
});

test('all participants follow the room provider flag and no caller may split a Render room',async()=>{
 await withServer(async(f,url)=>{
  f.rows.get('rooms/room-one').voiceProvider='agora';
  const denied=await post(url,validToken);
  assert.equal(denied.status,409);
  assert.equal((await denied.json()).error.code,'voice-provider-not-livekit');
  assert.equal(f.getWrites(),0);
 });
});


test('LiveKit-primary is opt-in for unassigned rooms and never overrides an explicit legacy room',async()=>{
 await withServer(async(f,url)=>{
  delete f.rows.get('rooms/room-one').voiceProvider;
  const denied=await post(url,validToken);
  assert.equal(denied.status,409);
  env.LIVEKIT_PRIMARY_FOR_UNSET_ROOMS='true';
  try{
   const allowed=await post(url,validToken);
   assert.equal(allowed.status,200);
   assert.equal((await allowed.json()).data.provider,'livekit');
   f.rows.get('rooms/room-one').voiceProvider='agora';
   assert.equal((await post(url,validToken)).status,409);
  }finally{delete env.LIVEKIT_PRIMARY_FOR_UNSET_ROOMS}
  assert.equal(f.getWrites(),0);
 });
});
