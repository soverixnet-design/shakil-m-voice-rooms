import {createServer} from 'node:http';
const badInput=new Set(['invalid-game','invalid-bet','invalid-request','request-conflict']);
const rejected=new Set(['bet-closed','insufficient-coins','inactive-user','bet-limit']);
export function createGameHttpServer({service,verifyToken,origins,ready=true}) {
 const allowed=new Set(origins),rates=new Map();
 const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
 const failure=(res,status,code,message=code)=>reply(res,status,{error:{code,message}});
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin){if(!allowed.has(origin))return failure(res,403,'permission-denied');res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');res.setHeader('Access-Control-Max-Age','600');}
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(path==='/health'&&req.method==='GET')return reply(res,ready?200:503,{status:ready?'ok':'setup-required',service:'earnbd-shared-games'});
  if(!['/api/sync','/api/bet'].includes(path))return failure(res,404,'not-found');
  if(req.method!=='POST')return failure(res,405,'invalid-argument');
  if(!ready)return failure(res,503,'unavailable','server-setup-required');
  const bearer=req.headers.authorization||'';if(!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(bearer))return failure(res,401,'unauthenticated');
  let identity;try{identity=await verifyToken(bearer.slice(7));if(!identity?.uid)throw Error('unauthenticated')}catch{return failure(res,401,'unauthenticated')}
  const now=Date.now(),previous=rates.get(identity.uid),rate=previous&&now-previous.start<60000?previous:{start:now,count:0};rate.count++;rates.set(identity.uid,rate);
  if(rates.size>10000)for(const [uid,b] of rates)if(now-b.start>=60000)rates.delete(uid);
  if(rate.count>120){res.setHeader('Retry-After','60');return failure(res,429,'resource-exhausted')}
  if(!req.headers['content-type']?.startsWith('application/json'))return failure(res,400,'invalid-argument');
  let text='',size=0;try{for await(const chunk of req){size+=chunk.length;if(size>32768){failure(res,413,'invalid-argument');req.destroy();return}text+=chunk.toString('utf8')}}catch{return}
  let data;try{data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid')}catch{return failure(res,400,'invalid-argument')}
  try{const result=path==='/api/sync'?await service.sync(data.game,identity.uid):await service.bet(data,identity.uid);return reply(res,200,{data:result})}catch(e){if(badInput.has(e.message))return failure(res,400,'invalid-argument',e.message);if(rejected.has(e.message))return failure(res,409,'failed-precondition',e.message);console.error('Game request failed:',e.code||'internal');return failure(res,503,'unavailable')}
 });
 server.requestTimeout=15000;server.headersTimeout=15000;
 return server;
}
