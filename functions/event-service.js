import {createHash} from 'node:crypto';
import {decodeFields,encodeFields} from './social-migration.js';
const OWNER='yfastvpn@gmail.com';
export const EVENT_TYPES=['top_sender','gift_festival','top_receiver','room_sender','room_game_rounds','room_game_wins','top_room_gifts','top_room_games'];
const validUser=u=>u&&!['banned','archived'].includes(u.status);
const fail=message=>{throw Object.assign(Error(message),{code:'invalid-argument'});};
export function validateEvent(input,now){
 const title=String(input.title||'').trim(),startAt=Number(input.startAt),endAt=Number(input.endAt),rewards=input.rewards;
 if(!title||title.length>100||!EVENT_TYPES.includes(input.type)||!Number.isSafeInteger(startAt)||!Number.isSafeInteger(endAt)||endAt<=startAt||endAt-startAt>31*86400000||endAt<=now||!Array.isArray(rewards)||rewards.length<1||rewards.length>10||rewards.some(n=>!Number.isSafeInteger(n)||n<1||n>1000000000))fail('invalid-event');
 const roomId=input.type.startsWith('room_')&&input.roomId?String(input.roomId):null,giftName=input.type==='gift_festival'&&input.giftName?String(input.giftName).trim():null;
 if(input.type.startsWith('room_')&&(!roomId||roomId.includes('/')||roomId.length>200))fail('invalid-event-room');
 if(input.type==='gift_festival'&&(!giftName||giftName.length>100))fail('invalid-event-gift');
 const banner=String(input.banner||'');if(banner.length>600000||banner&&!/^https:\/\//.test(banner)&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(banner))fail('invalid-event');
 const weekly=input.weekly===true;if(weekly&&endAt-startAt!==7*86400000)fail('weekly-event-must-be-seven-days');
 return {title,type:input.type,roomId,giftName,startAt,endAt,rewards,weekly,banner,rules:String(input.rules||'').slice(0,1500),state:'published'};
}
export function eventRanking(event,gifts,games,users,rooms){
 const scores=new Map();const gaming=event.type.includes('game');
 const add=(id,value,time)=>{if(!id||!Number.isSafeInteger(value)||value<=0)return;const previous=scores.get(id)||{id,score:0,firstAt:time};previous.score+=value;if(!Number.isSafeInteger(previous.score))fail('invalid-event-score');previous.firstAt=Math.min(previous.firstAt,time);scores.set(id,previous);};
 for(const row of gaming?games:gifts){
  const rawTime=gaming?(row.roundStartAt??row.createdAt):row.createdAt,time=typeof rawTime==='string'?Date.parse(rawTime):Number(rawTime);if(!Number.isFinite(time)||time<event.startAt||time>=event.endAt)continue;
  if(event.roomId&&row.roomId!==event.roomId)continue;
  if(!gaming&&row.type!=='gift_sent')continue;
  if(event.giftName&&row.giftName!==event.giftName)continue;
  const id=event.type.startsWith('top_room_')?row.roomId:event.type==='top_receiver'?row.receiverId:gaming?row.uid:row.senderId;
  const score=event.type==='gift_festival'?row.quantity:event.type==='room_game_wins'?row.payout:gaming?1:row.cost;
  add(id,Number(score),time);
 }
 return [...scores.values()].map(row=>{const room=event.type.startsWith('top_room_')?rooms.get(row.id):null;const uid=room?.hostId||(!event.type.startsWith('top_room_')?row.id:null),user=users.get(uid);return {...row,uid,name:room?.name||user?.name||'User',publicId:user?.id||'',avatar:room?.photoURL||user?.photoURL||user?.avatar||'👤',eligible:validUser(user)};}).filter(r=>r.eligible).sort((a,b)=>b.score-a.score||a.firstAt-b.firstAt||a.id.localeCompare(b.id)).map((r,index)=>({...r,rank:index+1,reward:event.rewards[index]||0}));
}
export function createEventService(database,clock=Date.now){
 const read=async(client,path)=>(await client.query('select fields from earnbd.social_documents where path=$1',[path])).rows[0];
 const put=async(client,path,data)=>{const parts=path.split('/'),id=parts.pop(),parent=parts.join('/');await client.query('insert into earnbd.social_documents(path,parent,document_id,fields) values($1,$2,$3,$4::jsonb) on conflict(path) do update set fields=excluded.fields,version=social_documents.version+1,updated_at=now()',[path,parent,id,JSON.stringify(encodeFields(data))]);};
 async function ranking(client,event){
  const gaming=event.type.includes('game'),parent=gaming?'gameReceipts':'transactions';
  const rows=(await client.query("select fields from earnbd.social_documents where parent=$1 and coalesce((fields->'roundStartAt'->>'integerValue')::numeric,(fields->'createdAt'->>'integerValue')::numeric,extract(epoch from (fields->'createdAt'->>'timestampValue')::timestamptz)*1000) >= $2 and coalesce((fields->'roundStartAt'->>'integerValue')::numeric,(fields->'createdAt'->>'integerValue')::numeric,extract(epoch from (fields->'createdAt'->>'timestampValue')::timestamptz)*1000) < $3",[parent,event.startAt,event.endAt])).rows.map(r=>decodeFields(r.fields));
  const profiles=(await client.query("select parent,document_id,fields from earnbd.social_documents where parent=any($1::text[])",[['users','rooms']])).rows;
  const users=new Map(),rooms=new Map();for(const r of profiles){const value=decodeFields(r.fields);if(r.parent==='users')users.set(r.document_id,value);else if(r.parent==='rooms')rooms.set(r.document_id,value);}
  return eventRanking(event,gaming?[]:rows,gaming?rows:[],users,rooms);
 }
 async function events(data,identity){
  return database.transaction(async client=>{
   const userRow=await read(client,'users/'+identity.uid),user=userRow&&decodeFields(userRow.fields);if(!validUser(user))throw Object.assign(Error('permission-denied'),{code:'permission-denied'});
   const grant=decodeFields((await read(client,'admins/'+identity.uid))?.fields);
   const owner=identity.email_verified===true&&identity.email?.toLowerCase()===OWNER;
   const manage=owner||Boolean(grant.active&&grant.permissions?.events);
   if(data.action==='create'){
    if(!manage)throw Object.assign(Error('permission-denied'),{code:'permission-denied'});
    const event=validateEvent(data.event,0),fingerprint=createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const requestId=data.requestId||fingerprint;if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(requestId))fail('invalid-request');
    const id=createHash('sha256').update(identity.uid+':'+requestId).digest('hex'),existing=await read(client,'events/'+id);
    if(existing){if(decodeFields(existing.fields).fingerprint!==fingerprint)fail('event-request-conflict');return {id};}
    validateEvent(data.event,clock());
    if(event.roomId&&!await read(client,'rooms/'+event.roomId))fail('invalid-event-room');
    await put(client,'events/'+id,{...event,id,fingerprint,createdBy:identity.uid,createdAt:clock()});return {id};
   }
   if(data.action==='cancel'){
    if(!manage)throw Object.assign(Error('permission-denied'),{code:'permission-denied'});
    const path='events/'+String(data.id),event=decodeFields((await read(client,path))?.fields);if(!event.id||event.state!=='published'||clock()>=event.startAt)fail('event-cannot-be-cancelled');await put(client,path,{...event,state:'cancelled'});return {ok:true};
   }
   if(data.action!=='list')fail('invalid-request');
   const list=(await client.query("select document_id,fields from earnbd.social_documents where parent='events'")).rows.map(r=>decodeFields(r.fields)).filter(e=>e.state!=='cancelled'||owner).sort((a,b)=>b.startAt-a.startAt).slice(0,30);
   const result=[];for(const e of list){const rows=e.state==='settled'?e.winners:clock()>=e.startAt?await ranking(client,e):[];result.push({...e,phase:e.state==='settled'?'settled':clock()<e.startAt?'upcoming':clock()<e.endAt?'active':'processing',ranking:rows.slice(0,100)});}return {events:result};
  });
 }
 async function settleEvent(id){return database.transaction(async client=>{
  const path='events/'+id,raw=await read(client,path),event=decodeFields(raw?.fields),grace=event.type?.includes('game')?120000:0;
  if(!raw||event.state!=='published'||clock()<event.endAt+grace)return;
  const winners=(await ranking(client,event)).filter(r=>r.reward>0);
  const profiles=new Map();for(const winner of winners){const receiptPath='walletRequests/event_'+id+'_'+winner.rank,receipt=await read(client,receiptPath);if(receipt)continue;const userPath='users/'+winner.uid;const user=profiles.get(userPath)||decodeFields((await read(client,userPath))?.fields);if(!validUser(user))continue;const balance=Number(user.coins||0)+winner.reward;if(!Number.isSafeInteger(balance))fail('invalid-event-balance');const next={...user,coins:balance};profiles.set(userPath,next);await put(client,userPath,next);const ledger={type:'event-reward',userId:winner.uid,eventId:id,eventTitle:event.title,rank:winner.rank,score:winner.score,amount:winner.reward,balance,createdAt:clock()};await put(client,receiptPath,ledger);await put(client,'transactions/event_'+id+'_'+winner.rank,ledger);}
  await put(client,path,{...event,state:'settled',winners,settledAt:clock()});
  if(event.weekly){const nextStart=event.endAt,nextEnd=nextStart+7*86400000,nextId=(event.seriesId||id)+'-'+nextStart;if(!await read(client,'events/'+nextId))await put(client,'events/'+nextId,{...event,id:nextId,seriesId:event.seriesId||id,startAt:nextStart,endAt:nextEnd,state:'published',winners:[],createdAt:clock(),settledAt:null});}
 });}
 async function sweepEvents(){const rows=(await database.pool.query("select document_id,fields from earnbd.social_documents where parent='events' and fields->'state'->>'stringValue'='published'")).rows;for(const row of rows){const e=decodeFields(row.fields);if(clock()>=e.endAt+(e.type.includes('game')?120000:0))await settleEvent(row.document_id);}}
 return {events,sweepEvents,settleEvent};
}
