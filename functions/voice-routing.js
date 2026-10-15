import {createHash} from 'node:crypto';
import tls from 'tls-sig-api-v2';
import {createAgoraVoiceConfig} from './agora-voice.js';
const fail=(message,code='unavailable')=>Object.assign(Error(message),{code});
// Quotas are operator-supplied remaining participant-minutes, never assumed trial entitlements.
export function voiceProviders(env=process.env){
 const providers=[];
 for(const id of (env.VOICE_PROVIDER_ORDER||'agora,tencent').split(',')){
  const name=id.trim(),prefix=name.toUpperCase(),cap=Number(env[prefix+'_FREE_MINUTES']);
  if(name==='agora'&&env.AGORA_APP_ID&&env.AGORA_APP_CERTIFICATE)providers.push({name,cap:Number.isFinite(cap)&&cap>0?cap:null});
  if(name==='tencent'&&/^\d+$/.test(env.TENCENT_SDK_APP_ID||'')&&/^[a-f0-9]{64}$/i.test(env.TENCENT_SECRET_KEY||'')&&env.TENCENT_ADVANCED_PERMISSION_ENABLED==='true'&&cap>0&&/^[A-Za-z0-9_-]{1,40}$/.test(env.VOICE_QUOTA_CYCLE||'')&&Number.isFinite(Date.parse(env.TENCENT_FREE_UNTIL||'')))providers.push({name,cap,expiresAt:Date.parse(env.TENCENT_FREE_UNTIL)});
 }
 return providers.some(p=>p.name==='tencent')?providers.filter(p=>p.cap!==null):providers;
}
export function createRoutedVoiceConfig(store,{env=process.env,clock=Date.now}={}){
 const providers=voiceProviders(env);
 return async(data,uid)=>{
  if(typeof data.roomId!=='string'||!data.roomId||data.roomId.includes('/')||data.roomId.length>200)throw fail('invalid-request','invalid-argument');
  if(!providers.length)throw fail('voice-not-configured');
  const now=clock(),cycle=env.VOICE_QUOTA_CYCLE||new Date(now).toISOString().slice(0,7);
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(cycle))throw fail('voice-not-configured');
  const routeRef=store.doc(`rooms/${data.roomId}/voiceRouting/current`),leaseRef=store.doc(`rooms/${data.roomId}/voiceLeases/${uid}`),budgetRef=store.doc(`system/voiceBudget_${cycle}`);
  const route=await store.runTransaction(async tx=>{
   const docs=await Promise.all([tx.get(store.doc(`users/${uid}`)),tx.get(store.doc(`rooms/${data.roomId}`)),tx.get(store.doc(`rooms/${data.roomId}/controls/${uid}`)),tx.get(routeRef),tx.get(leaseRef),tx.get(budgetRef)]);
   const [user,room,control={},previous={},lease={},budget={}]=docs.map(d=>d.data());
   if(!user||!room||['banned','archived'].includes(user.status)||control.blocked)throw fail('permission-denied','permission-denied');
   if(user.currentRoomId!==data.roomId){user.currentRoomId=data.roomId;tx.set(store.doc(`users/${uid}`),{...user,currentRoomId:data.roomId,online:true,lastSeen:new Date(now)});}
   const canPublish=Number.isInteger(user.roomSeat)&&user.roomSeat>=0&&user.roomSeat<(room.sc||(room.d?12:8))&&!control.muted;
   const used={...(budget.reservedMinutes||{})};
   let index=previous.cycle===cycle?providers.findIndex(p=>p.name===previous.provider):0;if(index<0)index=0;
   let provider=providers[index],same=lease.cycle===cycle&&lease.provider===provider.name&&lease.until>now+30000;
   // Reserve 90 seconds per authenticated participant. Abandoned leases are not refunded.
   // Conservative ledger survives retries/restarts; provider invoices remain authoritative.
   while(provider&&(provider.expiresAt&&provider.expiresAt<now+90000||!same&&provider.cap!==null&&(used[provider.name]||0)+1.5>provider.cap)){index++;provider=providers[index];same=!!provider&&lease.cycle===cycle&&lease.provider===provider.name&&lease.until>now+30000;}
   if(!provider)throw fail('voice-quota-exhausted');
   const changed=previous.provider!==provider.name||previous.cycle!==cycle;
   const epoch=changed?(previous.epoch||0)+1:previous.epoch||1;
   let until=lease.until;
   if(!same){until=now+90000;used[provider.name]=(used[provider.name]||0)+1.5;tx.set(budgetRef,{reservedMinutes:used,updatedAt:now});tx.set(leaseRef,{cycle,provider:provider.name,until});}
   if(changed)tx.set(routeRef,{provider:provider.name,cycle,epoch,changedAt:now});
   // Successful authenticated RTC renewal also keeps room membership visible.
   // Never change a confirmed seat while refreshing presence.
   const seen=user.lastSeen?.toMillis?.()??user.lastSeen?.getTime?.()??Date.parse(user.lastSeen||'');
   if(!Number.isFinite(seen)||now-seen>=30000)tx.set(store.doc(`users/${uid}`),{...user,online:true,lastSeen:new Date(now)});
   return {provider:provider.name,epoch,canPublish,leaseUntil:until,reservedMinutes:used[provider.name],quotaMinutes:provider.cap};
  });
  if(route.provider==='agora')return {...await createAgoraVoiceConfig(store,{appId:env.AGORA_APP_ID,certificate:env.AGORA_APP_CERTIFICATE,clock,lifetime:Math.max(1,Math.floor((route.leaseUntil-clock())/1000))})(data,uid),...route};
  const appId=Number(env.TENCENT_SDK_APP_ID),signer=new tls.Api(appId,env.TENCENT_SECRET_KEY);
  const channel='room_'+createHash('sha256').update(data.roomId).digest('hex').slice(0,48);
  if(!/^[A-Za-z0-9_-]{1,32}$/.test(uid))throw fail('voice-user-id-unsupported');
  const seconds=Math.max(1,Math.floor((route.leaseUntil-now)/1000));
  return {...route,appId,channel,uid,token:signer.genUserSig(uid,seconds),privateMapKey:signer.genPrivateMapKeyWithStringRoomID(uid,seconds,channel,route.canPublish?15:11),expiresAt:now+seconds*1000,renewAfterMs:20000};
 };
}
