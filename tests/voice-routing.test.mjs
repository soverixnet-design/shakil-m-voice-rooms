import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createRoutedVoiceConfig,voiceProviders} from '../functions/voice-routing.js';
function fixture(){
 const env={AGORA_APP_ID:'a'.repeat(32),AGORA_APP_CERTIFICATE:'b'.repeat(32),AGORA_FREE_MINUTES:'3',TENCENT_SDK_APP_ID:'20049429',TENCENT_SECRET_KEY:'c'.repeat(64),TENCENT_FREE_MINUTES:'10',TENCENT_ADVANCED_PERMISSION_ENABLED:'true',VOICE_QUOTA_CYCLE:'2026-10',TENCENT_FREE_UNTIL:'2026-11-01T00:00:00Z'};
 const rows=new Map([['users/alice',{currentRoomId:'room',roomSeat:0}],['users/bob',{currentRoomId:'room',roomSeat:null}],['rooms/room',{sc:8}]]);
 let now=Date.UTC(2026,9,14),chain=Promise.resolve();
 const store={doc:path=>({path}),runTransaction:fn=>{const task=chain.then(async()=>{const writes=[];const result=await fn({get:async ref=>({data:()=>rows.get(ref.path)}),set:(ref,value)=>writes.push([ref.path,value])});writes.forEach(([p,v])=>rows.set(p,v));return result});chain=task.catch(()=>{});return task}};
 const config=createRoutedVoiceConfig(store,{env,clock:()=>now});return {env,rows,config,advance:ms=>now+=ms};
}
test('quota reservations are idempotent across concurrent refresh and server restart',async()=>{const f=fixture();await Promise.all([f.config({roomId:'room'},'alice'),f.config({roomId:'room'},'alice')]);assert.equal(f.rows.get('system/voiceBudget_2026-10').reservedMinutes.agora,1.5);const restarted=createRoutedVoiceConfig({doc:p=>({path:p}),runTransaction:async fn=>fn({get:async r=>({data:()=>f.rows.get(r.path)}),set:()=>{throw Error('must not reserve twice')}})},{env:f.env,clock:()=>Date.UTC(2026,9,14)});assert.equal((await restarted({roomId:'room'},'alice')).provider,'agora');});
test('room switches once when quota is depleted and all participants follow the same epoch',async()=>{const f=fixture();await f.config({roomId:'room'},'alice');await f.config({roomId:'room'},'bob');f.advance(61000);const a=await f.config({roomId:'room'},'alice'),b=await f.config({roomId:'room'},'bob');assert.equal(a.provider,'tencent');assert.equal(b.provider,a.provider);assert.equal(b.epoch,a.epoch);assert.equal(a.channel,b.channel);assert(!JSON.stringify(a).includes(f.env.TENCENT_SECRET_KEY));});
test('Tencent permissions differ for seated speakers and listeners',async()=>{const f=fixture();f.env.VOICE_PROVIDER_ORDER='tencent';const config=createRoutedVoiceConfig({doc:p=>({path:p}),runTransaction:async fn=>fn({get:async r=>({data:()=>f.rows.get(r.path)}),set:(r,v)=>f.rows.set(r.path,v)})},{env:f.env,clock:()=>Date.UTC(2026,9,14)});const decode=s=>JSON.parse(inflateSync(Buffer.from(s.replace(/\*/g,'+').replace(/-/g,'/').replace(/_/g,'='),'base64')));const a=await config({roomId:'room'},'alice'),b=await config({roomId:'room'},'bob');assert(a.canPublish);assert(!b.canPublish);assert.notEqual(decode(a.privateMapKey)['TLS.userbuf'],decode(b.privateMapKey)['TLS.userbuf']);});
test('non-members and blocked users cannot spend quota or receive tokens',async()=>{const f=fixture();f.rows.get('users/alice').currentRoomId='elsewhere';await assert.rejects(f.config({roomId:'room'},'alice'),/permission-denied/);assert(!f.rows.has('system/voiceBudget_2026-10'));});
test('Tencent is excluded without advanced permission confirmation or a verified budget',()=>{const f=fixture();f.env.TENCENT_ADVANCED_PERMISSION_ENABLED='false';assert(!voiceProviders(f.env).some(p=>p.name==='tencent'));f.env.TENCENT_ADVANCED_PERMISSION_ENABLED='true';delete f.env.TENCENT_FREE_MINUTES;assert(!voiceProviders(f.env).some(p=>p.name==='tencent'));});
test('all exhausted providers fail closed rather than issuing a billable token',async()=>{const f=fixture();await f.config({roomId:'room'},'alice');f.advance(61000);await f.config({roomId:'room'},'alice');f.rows.set('system/voiceBudget_2026-10',{reservedMinutes:{agora:3,tencent:10}});f.advance(61000);await assert.rejects(f.config({roomId:'room'},'alice'),/voice-quota-exhausted/);});

test('expired Tencent trial is never selected even when budget remains',async()=>{const f=fixture();f.advance(20*86400000);f.rows.set('system/voiceBudget_2026-10',{reservedMinutes:{agora:3}});await assert.rejects(f.config({roomId:'room'},'alice'),/voice-quota-exhausted/);});

test('free-only routing excludes an Agora fallback whose remaining quota is unverified',()=>{const f=fixture();delete f.env.AGORA_FREE_MINUTES;assert.deepEqual(voiceProviders(f.env).map(p=>p.name),['tencent']);});

test('voice renewal keeps presence fresh without dropping the confirmed seat',async()=>{const f=fixture();await f.config({roomId:'room'},'alice');const before=f.rows.get('users/alice');assert.equal(before.roomSeat,0);assert.equal(before.online,true);f.advance(40000);await f.config({roomId:'room'},'alice');const after=f.rows.get('users/alice');assert.equal(after.roomSeat,0);assert.equal(after.currentRoomId,'room');assert(after.lastSeen.getTime()>before.lastSeen.getTime());});

import {voiceTokenDeadline} from '../src/lib/voiceTokenClock.ts';
test('Tencent token renewal is independent of the phone wall clock and accounts for network delay',async()=>{
 const f=fixture();f.env.VOICE_PROVIDER_ORDER='tencent';const config=createRoutedVoiceConfig({doc:p=>({path:p}),runTransaction:async fn=>fn({get:async r=>({data:()=>f.rows.get(r.path)}),set:(r,v)=>f.rows.set(r.path,v)})},{env:f.env,clock:()=>Date.UTC(2026,9,14)});
 const token=await config({roomId:'room'},'alice');assert.equal(token.expiresAt-token.serverNow,90000);assert.equal(voiceTokenDeadline(token,1000,6000),91000);assert.equal(voiceTokenDeadline(token,1000,101000),101000);
});
