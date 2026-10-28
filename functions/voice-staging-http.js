import {createServer} from 'node:http';
import {createLiveKitVoiceConfig,liveKitIsConfigured} from './livekit-voice.js';

// The staging API deliberately offers no game, wallet, gifts or admin routes.
// Firestore operations here are reads only; live room routing is untouched.
export function createVoiceStagingHttpServer({database,verifyIdToken,env=process.env,clock=Date.now}={}){
 if(!database?.doc||typeof verifyIdToken!=='function')throw Error('voice-staging-dependencies-required');
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
   res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  }
  const path=new URL(req.url||'/','http://localhost').pathname;
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&path==='/health')return send(res,liveKitIsConfigured(env)?200:503,{
   status:liveKitIsConfigured(env)?'ok':'configuration-required',
   mode:'voice-only-staging',provider:'livekit',firestoreWrites:false,
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
   const docs=await Promise.all([
    database.doc('users/'+identity.uid).get(),
    database.doc('rooms/'+roomId).get(),
    database.doc('rooms/'+roomId+'/controls/'+identity.uid).get()
   ]);
   const [user,room,control={}]=docs.map(d=>d.data?.());
   if(!user||!room||user.currentRoomId!==roomId||['banned','archived','suspended'].includes(user.status)||control.blocked)return fail(res,403,'permission-denied');
   if(room.voiceProvider!=='livekit')return fail(res,409,'voice-provider-not-livekit');
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
