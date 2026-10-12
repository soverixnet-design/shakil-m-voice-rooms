import {createServer} from 'node:http';
const badInput=new Set(['invalid-game','invalid-bet','invalid-request','request-conflict','invalid-gift','invalid-exchange']);
const rejected=new Set(['bet-closed','insufficient-coins','inactive-user','bet-limit','insufficient-diamonds']);
export function createGameHttpServer({service,verifyToken,origins,ready=true,checkReady}) {
 const allowed=new Set(origins),rates=new Map();let healthCache=null,healthAt=0,healthPending=null;
 async function health(){
  if(!checkReady||!ready)return {status:ready?'ok':'setup-required'};
  if(healthCache&&Date.now()-healthAt<30000)return healthCache;
  if(healthPending)return healthPending;
  healthPending=(async()=>{let timer;try{await Promise.race([checkReady(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('database-timeout')),5000)})]);healthCache={status:'ok',database:'connected'}}catch(e){const code=String(e.code||'');healthCache={status:'database-unavailable',database:'unavailable',reason:code==='8'||code==='resource-exhausted'?'database-quota-exceeded':code==='7'||code==='permission-denied'?'server-database-permission-denied':'database-connection-failed'}}finally{clearTimeout(timer);healthAt=Date.now();healthPending=null}return healthCache;})();return healthPending;
 }

 const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
 const failure=(res,status,code,message=code)=>reply(res,status,{error:{code,message}});
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin){if(!allowed.has(origin))return failure(res,403,'permission-denied');res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');res.setHeader('Access-Control-Max-Age','600');}
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(path==='/health'&&req.method==='GET'){const result=await health();return reply(res,result.status==='ok'?200:503,{...result,service:'earnbd-shared-games',apiVersion:3,features:['shared-rounds','weekly-ranking','wallet-gifts','diamond-exchange','rapid-taps','database-probe']});}
  if(!['/api/sync','/api/bet','/api/gift','/api/exchange','/api/voice-config'].includes(path))return failure(res,404,'not-found');
  if(req.method!=='POST')return failure(res,405,'invalid-argument');
  if(!ready)return failure(res,503,'unavailable','server-setup-required');
  const bearer=req.headers.authorization||'';if(!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(bearer))return failure(res,401,'unauthenticated');
  let identity;try{identity=await verifyToken(bearer.slice(7));if(!identity?.uid)throw Error('unauthenticated')}catch{return failure(res,401,'unauthenticated')}
  const now=Date.now(),previous=rates.get(identity.uid),rate=previous&&now-previous.start<60000?previous:{start:now,count:0};rate.count++;rates.set(identity.uid,rate);
  if(rates.size>10000)for(const [uid,b] of rates)if(now-b.start>=60000)rates.delete(uid);
  if(rate.count>120){res.setHeader('Retry-After','60');return failure(res,429,'resource-exhausted')}
  if(!req.headers['content-type']?.startsWith('application/json'))return failure(res,400,'invalid-argument');
  let text='',size=0;try{for await(const chunk of req){size+=chunk.length;if(size>(path==='/api/gift'?700000:32768)){failure(res,413,'invalid-argument');req.destroy();return}text+=chunk.toString('utf8')}}catch{return}
  let data;try{data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid')}catch{return failure(res,400,'invalid-argument')}
  try{const result=path==='/api/sync'?await service.sync(data.game,identity.uid):path==='/api/bet'?await service.bet(data,identity.uid):path==='/api/gift'?await service.gift(data,identity.uid):path==='/api/exchange'?await service.exchange(data,identity.uid):await service.voiceConfig(data,identity.uid);return reply(res,200,{data:result})}catch(e){if(badInput.has(e.message))return failure(res,400,'invalid-argument',e.message);if(rejected.has(e.message))return failure(res,409,'failed-precondition',e.message);console.error('Game request failed:',e.code||'internal');if(e.code===8||e.code==='resource-exhausted')return failure(res,503,'resource-exhausted','database-quota-exceeded');if(e.code===7||e.code==='permission-denied')return failure(res,503,'unavailable','server-database-permission-denied');return failure(res,503,'unavailable','database-connection-failed')}
 });
 server.requestTimeout=15000;server.headersTimeout=15000;
 return server;
}
