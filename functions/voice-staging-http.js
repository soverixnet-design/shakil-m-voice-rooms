import {createServer} from 'node:http';
import {createLiveKitVoiceConfig,liveKitIsConfigured} from './livekit-voice.js';

// The staging API deliberately offers no game, wallet, gifts or admin routes.
// Firestore operations here are reads only; live room routing is untouched.
export function createVoiceStagingHttpServer({database,readRoomMembership,verifyIdToken,env=process.env,clock=Date.now}={}){
 if((!database?.doc&&typeof readRoomMembership!=='function')||typeof verifyIdToken!=='function')throw Error('voice-staging-dependencies-required');
 const allowed=new Set((env.ALLOWED_ORIGINS||'https://soverixnet-design.github.io,https://localhost,capacitor://localhost,http://localhost').split(',').map(v=>v.trim()).filter(Boolean));
 const requests=new Map();
 const send=(res,status,value)=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(value));
 };
 const fail=(res,status,code)=>send(res,status,{error:{code,message:code}});
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin){
   if(!allowed.has(origin))return fail(res,403,'permission-denied');
   res.setHeader('Access-Control-Allow-Origin',origin);
   res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-EarnBD-Device');
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  }
  const path=new URL(req.url||'/','http://localhost').pathname;
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&path==='/health')return send(res,liveKitIsConfigured(env)?200:503,{
   status:liveKitIsConfigured(env)?'ok':'configuration-required',
   mode:'voice-only-staging',provider:'livekit',firestoreWrites:false,
   livekitPrimaryForUnassignedRooms:env.LIVEKIT_PRIMARY_FOR_UNSET_ROOMS==='true',
   routes:['GET /health','POST /api/voice-config']
  });
  if(path!=='/api/voice-config')return fail(res,404,'not-found');
  if(req.method!=='POST')return fail(res,405,'method-not-allowed');
  if(!liveKitIsConfigured(env))return fail(res,503,'voice-not-configured');
  const authorization=/^Bearer ([A-Za-z0-9._-]{20,8192})$/.exec(req.headers.authorization||'');
  if(!authorization)return fail(res,401,'unauthenticated');
  if(!req.headers['content-type']?.startsWith('application/json'))return fail(res,400,'invalid-argument');
  let body='',size=0;
  try{
   for await(const chunk of req){
    size+=chunk.length;
    if(size>4096){fail(res,413,'request-too-large');req.destroy();return;}
    body+=chunk.toString('utf8');
   }
  }catch{return;}
  let data;
  try{data=JSON.parse(body);}catch{return fail(res,400,'invalid-argument');}
  const roomId=data?.roomId;
  if(typeof roomId!=='string'||roomId.length<1||roomId.length>200||roomId.includes('/'))return fail(res,400,'invalid-argument');
  let timeout;
  try{
   let identity;
   try{identity=await Promise.race([
    verifyIdToken(authorization[1]),
    new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('auth-timeout')),8000);})
   ]);}catch(error){return fail(res,error?.message==='auth-timeout'?503:401,error?.message==='auth-timeout'?'auth-timeout':'unauthenticated');}
   if(!identity?.uid||!/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid))return fail(res,401,'unauthenticated');
   const now=clock(),bucket=requests.get(identity.uid);
   const next=bucket&&now-bucket.start<60000?bucket:{start:now,count:0};
   if(++next.count>30)return fail(res,429,'rate-limited');
   requests.set(identity.uid,next);
   if(requests.size>2000)for(const [uid,b] of requests)if(now-b.start>60000)requests.delete(uid);
   // Membership must come from the same authoritative social store that accepts
   // room joins and seat updates. Firestore remains a test-only legacy fallback.
   const [user,room,control={}]=typeof readRoomMembership==='function'
    ?await readRoomMembership({uid:identity.uid,roomId,idToken:authorization[1],deviceId:req.headers['x-earnbd-device']})
    :(await Promise.all([
      database.doc('users/'+identity.uid).get(),
      database.doc('rooms/'+roomId).get(),
      database.doc('rooms/'+roomId+'/controls/'+identity.uid).get()
     ])).map(d=>d.data?.());
   if(!user||!room||user.currentRoomId!==roomId||['banned','archived','suspended'].includes(user.status)||control.blocked)return fail(res,403,'permission-denied');
   // Room-level choice is authoritative. Default LiveKit requires the same explicit
   // staged rollout switch on server AND all test clients.
   if(room.voiceProvider!=='livekit'&&!(env.LIVEKIT_PRIMARY_FOR_UNSET_ROOMS==='true'&&room.voiceProvider===undefined))return fail(res,409,'voice-provider-not-livekit');
   const seatCount=room.sc||(room.d?12:8);
   const canPublish=Number.isInteger(user.roomSeat)&&user.roomSeat>=0&&user.roomSeat<seatCount&&!control.muted;
   const config=createLiveKitVoiceConfig({env,roomId,uid:identity.uid,canPublish,clock});
   return send(res,200,{data:{...config,serverNow:now,staging:true}});
  }catch(error){
   console.error('Voice staging request failed:',error?.code||'backend-unavailable');
   return fail(res,error?.message==='auth-timeout'?503:503,'voice-backend-unavailable');
  }finally{clearTimeout(timeout);}
 });
 server.requestTimeout=15000;
 server.headersTimeout=15000;
 return server;
}


// Read-only bridge to the existing Render/Supabase social API. Firebase ID tokens
// are verified by BOTH servers, and Render applies its normal device and document
// access controls. Never accept caller-supplied membership or seat information.
export function createSocialMembershipReader({url='https://shakil-m-voice-rooms.onrender.com/api/social',request=fetch,timeoutMs=10000}={}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||!endpoint.hostname||endpoint.username||endpoint.password)throw Error('invalid-social-api-url');
 const decode=value=>{
  if(!value||typeof value!=='object')return undefined;
  if('stringValue' in value)return value.stringValue;
  if('integerValue' in value)return Number(value.integerValue);
  if('doubleValue' in value)return Number(value.doubleValue);
  if('booleanValue' in value)return value.booleanValue===true;
  if('nullValue' in value)return null;
  if('timestampValue' in value)return value.timestampValue;
  if('arrayValue' in value)return (value.arrayValue?.values||[]).map(decode);
  if('mapValue' in value)return Object.fromEntries(Object.entries(value.mapValue?.fields||{}).map(([key,item])=>[key,decode(item)]));
  return undefined;
 };
 const docFields=fields=>fields?Object.fromEntries(Object.entries(fields).map(([key,item])=>[key,decode(item)])):null;
 return async({uid,roomId,idToken,deviceId})=>{
  const device=typeof deviceId==='string'&&/^[\x20-\x7e]{1,512}$/.test(deviceId)?deviceId:null;
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+idToken,...(device?{'X-EarnBD-Device':device}:{})};
  const paths=['users/'+uid,'rooms/'+roomId,'rooms/'+roomId+'/controls/'+uid];
  return Promise.all(paths.map(async path=>{
   const abort=new AbortController();
   const timer=setTimeout(()=>abort.abort(),timeoutMs);
   try{
    const response=await request(endpoint.toString(),{method:'POST',headers,body:JSON.stringify({action:'get',path}),signal:abort.signal});
    if(!response.ok)throw Object.assign(Error('social-membership-unavailable'),{status:response.status});
    const payload=await response.json();
    if(payload.error)throw Error('social-membership-unavailable');
    return docFields(payload.data?.fields);
   }finally{clearTimeout(timer);}
  }));
 };
}
