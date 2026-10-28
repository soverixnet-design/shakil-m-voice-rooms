import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceStagingHttpServer,createSocialMembershipReader} from '../functions/voice-staging-http.js';

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


test('allowed browser preflight includes the existing installation device header',async()=>{
 await withServer(async(f,url)=>{
  const response=await fetch(url+'/api/voice-config',{method:'OPTIONS',headers:{
   Origin:'https://allowed.example.test',
   'Access-Control-Request-Method':'POST',
   'Access-Control-Request-Headers':'authorization,content-type,x-earnbd-device'
  }});
  assert.equal(response.status,204);
  assert.match(response.headers.get('access-control-allow-headers'),/X-EarnBD-Device/i);
  assert.equal(f.getWrites(),0);
 });
});

test('Render membership reader uses the signed Firebase identity, room document and device policy',async()=>{
 const seen=[];
 const fields=path=>path==='users/alice'?{currentRoomId:{stringValue:'room-one'},roomSeat:{integerValue:'2'},status:{stringValue:'active'}}:
  path==='rooms/room-one'?{sc:{integerValue:'8'},voiceProvider:{stringValue:'livekit'}}:
  {muted:{booleanValue:false},blocked:{booleanValue:false}};
 const reader=createSocialMembershipReader({request:async(_url,options)=>{
  const body=JSON.parse(options.body);
  seen.push({path:body.path,auth:options.headers.Authorization,device:options.headers['X-EarnBD-Device']});
  return {ok:true,json:async()=>({data:{fields:fields(body.path)}})};
 }});
 const docs=await reader({uid:'alice',roomId:'room-one',idToken:validToken,deviceId:'verified-device'});
 assert.equal(docs[0].currentRoomId,'room-one');
 assert.equal(docs[0].roomSeat,2);
 assert.equal(docs[1].sc,8);
 assert.equal(docs[2].muted,false);
 assert.deepEqual(seen.map(x=>x.path),['users/alice','rooms/room-one','rooms/room-one/controls/alice']);
 assert.ok(seen.every(x=>x.auth==='Bearer '+validToken&&x.device==='verified-device'));
});
test('LiveKit staging reads authoritative membership and fails closed without Firestore fallback',async()=>{
 let joined=true;
 const server=createVoiceStagingHttpServer({env,verifyIdToken:async()=>({uid:'alice'}),
  readRoomMembership:async()=>[
   {currentRoomId:joined?'room-one':'another-room',roomSeat:0,status:'active'},
   {sc:8,voiceProvider:'livekit'},
   {muted:false,blocked:false}
  ]});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await post(url,validToken)).status,200);
  joined=false;
  assert.equal((await post(url,validToken)).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('valid member without an optional room control document can obtain a LiveKit token',async()=>{
 const server=createVoiceStagingHttpServer({env,verifyIdToken:async()=>({uid:'alice'}),readRoomMembership:async()=>[
  {currentRoomId:'room-one',roomSeat:1,status:'active'},
  {sc:8,voiceProvider:'livekit'},
  null
 ]});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  const response=await post(url,validToken);
  assert.equal(response.status,200);
  assert.equal((await response.json()).data.canPublish,true);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('Render membership API errors cannot create LiveKit room access',async()=>{
 const reader=createSocialMembershipReader({request:async()=>({ok:false,status:403})});
 await assert.rejects(reader({uid:'alice',roomId:'room-one',idToken:validToken}),/social-membership-unavailable/);
});
