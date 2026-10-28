import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createLiveKitVoiceConfig,liveKitIsConfigured} from '../functions/livekit-voice.js';
import {createRoutedVoiceConfig,voiceProviders} from '../functions/voice-routing.js';

function fixture(){
 const env={LIVEKIT_ENABLED:'true',LIVEKIT_URL:'wss://voice.example.test',LIVEKIT_API_KEY:'API_key_test',LIVEKIT_API_SECRET:'s'.repeat(48),LIVEKIT_MINUTES_BUDGET:'3',VOICE_PROVIDER_ORDER:'livekit',VOICE_QUOTA_CYCLE:'test-voice-202610'};
 const rows=new Map([['users/alice',{currentRoomId:'my-room',roomSeat:0}],['users/bob',{currentRoomId:'my-room',roomSeat:null}],['rooms/my-room',{sc:8}]]);
 const store={doc:path=>({path}),runTransaction:async fn=>{const changes=[];const result=await fn({get:async ref=>({data:()=>rows.get(ref.path)}),set:(ref,value)=>changes.push([ref.path,value])});for(const [path,value]of changes)rows.set(path,value);return result}};
 return {env,rows,store,config:()=>createRoutedVoiceConfig(store,{env,clock:()=>Date.UTC(2026,9,27,14)})};
}

test('Akira-style LiveKit provider is explicitly opt-in and never changes existing default routing',()=>{
 const f=fixture();delete f.env.LIVEKIT_ENABLED;
 assert.equal(liveKitIsConfigured(f.env),false);
 assert.deepEqual(voiceProviders(f.env),[]);
 f.env.LIVEKIT_ENABLED='true';delete f.env.LIVEKIT_MINUTES_BUDGET;
 assert.deepEqual(voiceProviders(f.env).map(p=>p.name),['livekit']);
 f.env.LIVEKIT_URL='ws://unsecured.test';
 assert.deepEqual(voiceProviders(f.env),[]);
});

test('LiveKit tokens are signed, isolated from Akira rooms and seat-permission restricted',async()=>{
 const f=fixture(),a=await f.config()({roomId:'my-room'},'alice'),b=await f.config()({roomId:'my-room'},'bob');
 assert.equal(a.provider,'livekit');assert.equal(a.channel,b.channel);
 assert.match(a.channel,/^shakilm-[a-f0-9]{48}$/);assert.equal(a.url,'wss://voice.example.test');
 assert.equal(a.canPublish,true);assert.equal(b.canPublish,false);
 const decode=value=>JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
 for(const entry of [a,b]){
  const [header,payload,signature]=entry.token.split('.');
  assert.equal(decode(header).alg,'HS256');
  assert.equal(createHmac('sha256',f.env.LIVEKIT_API_SECRET).update(header+'.'+payload).digest('base64url'),signature);
  const claims=decode(payload);
  assert.equal(claims.video.room,a.channel);
  assert.equal(claims.video.roomJoin,true);
  assert.equal(claims.video.canPublish,entry.canPublish);
  assert.equal(claims.video.canSubscribe,true);
  assert.equal(claims.video.canPublishData,false);
  assert.deepEqual(claims.video.canPublishSources,entry.canPublish?['microphone']:undefined);
  assert.equal(claims.exp-claims.iat,600);
  assert(!JSON.stringify(entry).includes(f.env.LIVEKIT_API_SECRET));
 }
});

test('blocked users or non-members cannot mint LiveKit access tokens or reserve quota',async()=>{
 const f=fixture();f.rows.get('users/alice').currentRoomId='other-room';
 await assert.rejects(f.config()({roomId:'my-room'},'alice'),/permission-denied/);
 assert(!f.rows.has('system/voiceBudget_test-voice-202610'));
 f.rows.get('users/alice').currentRoomId='my-room';f.rows.set('rooms/my-room/controls/alice',{blocked:true});
 await assert.rejects(f.config()({roomId:'my-room'},'alice'),/permission-denied/);
});

test('self-hosted LiveKit is always the primary unmetered provider and Agora remains configured as standby',async()=>{
 const f=fixture();f.env.AGORA_APP_ID='a'.repeat(32);f.env.AGORA_APP_CERTIFICATE='b'.repeat(32);f.env.AGORA_FREE_MINUTES='6';
 f.env.VOICE_PROVIDER_ORDER='livekit,agora';f.env.LIVEKIT_MINUTES_BUDGET='1.5';
 assert.deepEqual(voiceProviders(f.env).map(p=>[p.name,p.cap]),[['livekit',null],['agora',6]]);
 const first=await f.config()({roomId:'my-room'},'alice');
 const second=await f.config()({roomId:'my-room'},'bob');
 assert.equal(first.provider,'livekit');assert.equal(second.provider,'livekit');
 assert.equal(first.quotaMinutes,null);
 assert.equal(f.rows.has('system/voiceBudget_test-voice-202610'),false);
});

test('LiveKit signing rejects malformed room and user identities',()=>{
 const f=fixture();
 assert.throws(()=>createLiveKitVoiceConfig({env:f.env,roomId:'foo/bar',uid:'alice'}),/invalid-request/);
 assert.throws(()=>createLiveKitVoiceConfig({env:f.env,roomId:'my-room',uid:'bad/user'}),/invalid-user/);
});
