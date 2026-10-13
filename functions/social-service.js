import {randomInt,createHmac} from 'node:crypto';
import {decodeFields,decodeValue,encodeFields} from './social-migration.js';
const OWNER='yfastvpn@gmail.com';
const ROOTS=new Set(['users','rooms','roomOwners','follows','moments','diamondWallets','transactions','admins','assets','system','supportTickets','sellerWallets','sellerTransfers']);
const PROTECTED=new Set(['role','status','email','id','userId','coins','diamond','lastSellerTransfer','lastGiftReceipt','giftSentCount','giftSentCoins','totalRecharged','giftReceivedCount','giftReceivedCoins']);
const fail=code=>{throw Object.assign(Error(code),{code});};
const allowed=(value,keys)=>Object.keys(value).every(k=>keys.includes(k));
const photo=v=>typeof v==='string'&&v.length<=300000&&(!v||/^https:\/\//.test(v)||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(v));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const changed=(a,b)=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>!same(a[k],b[k]));
export function socialPath(path){return typeof path==='string'&&path.split('/').length<=4&&path.length<=512&&path.split('/').every(v=>v&&!['.','..','__proto__','constructor','prototype'].includes(v))&&ROOTS.has(path.split('/')[0]);}
export function createSocialService(database,clock=Date.now){
 const nameRoot='projects/gen-lang-client-0043151803/databases/ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b/documents';
 const wire=row=>row?{name:nameRoot+'/'+row.path,fields:row.fields,updateTime:'version-'+String(row.version)}:null;
 const read=(client,path)=>client.query('select path,fields,updated_at,version from earnbd.social_documents where path=$1',[path]).then(r=>r.rows[0]);
 async function social(data,identity){
  if(!identity?.uid)fail('unauthenticated');
  return database.transaction(async client=>{
   const own=await read(client,'users/'+identity.uid),profile=decodeFields(own?.fields);
   const owner=identity.email_verified===true&&identity.email?.toLowerCase()===OWNER;
   const active=own&&!['banned','archived'].includes(profile.status);
   const grant=decodeFields((await read(client,'admins/'+identity.uid))?.fields);
   const permission=name=>Boolean(active&&grant.active&&grant.permissions?.[name]);
   const requireActive=()=>{if(!active)fail('permission-denied');};
   const plain=async path=>decodeFields((await read(client,path))?.fields);
   const roomOwner=async room=>(await plain('rooms/'+room)).hostId===identity.uid;
   const roomAdmin=async room=>await roomOwner(room)||(await plain(`rooms/${room}/roles/${identity.uid}`)).role==='admin';
   const inRoom=async room=>{
    if(!active||profile.currentRoomId!==room)return false;
    const controls=await plain(`rooms/${room}/controls/${identity.uid}`);
    return controls.blocked!==true;
   };
   async function canRead(path,fields){
    if(!socialPath(path))return false;
    const [root,id,sub,child]=path.split('/');
    if(root==='system'||root==='assets')return !sub;
    if(root==='admins')return !sub&&(owner||id===identity.uid);
    if(root==='sellerWallets')return !sub&&(owner||active&&id===identity.uid);
    if(root==='sellerTransfers'){const d=decodeFields(fields);return !sub&&(owner||active&&[d.sellerId,d.receiverId].includes(identity.uid));}
    if(root==='supportTickets')return active&&(id===identity.uid||owner||permission('support'))&&(!sub||sub==='messages');
    if(root==='users')return sub==='roomLibrary'?id===identity.uid:(!sub||sub==='visitors')&&(active||!sub&&id===identity.uid);
    if(root==='roomOwners')return !sub&&(id===identity.uid||owner);
    if(root==='rooms'){
     if(!sub)return true;
     if(['roles','controls','seatPolicy','chat','giftEvents'].includes(sub))return Boolean(active);
     if(sub==='voicePeers')return inRoom(id);
     if(sub==='voiceSignals')return await inRoom(id)&&decodeFields(fields).to===identity.uid;
     return false;
    }
    if(root==='diamondWallets')return !sub&&Boolean(active)&&(id===identity.uid||owner);
    if(root==='transactions'){const d=decodeFields(fields);return !sub&&Boolean(active)&&(owner||[d.userId,d.senderId,d.receiverId].includes(identity.uid));}
    return ['follows','moments'].includes(root)&&!sub&&Boolean(active);
   }
   if(data.action==='get'){
    if(!socialPath(data.path)||data.path.split('/').length%2!==0)fail('invalid-argument');
    const row=await read(client,data.path);
    if(!await canRead(data.path,row?.fields))fail('permission-denied');
    return wire(row);
   }
   if(data.action==='query'){
    const parent=data.parent||'',q=data.structuredQuery;
    if(!q||q.from?.length!==1||q.from[0].allDescendants)fail('invalid-argument');
    const collection=q.from[0].collectionId;
    if(typeof collection!=='string'||collection.includes('/'))fail('invalid-argument');
    const path=(parent?parent+'/':'')+collection;
    if(!socialPath(path)||path.split('/').length%2!==1)fail('invalid-argument');
    const candidate=path+'/query-probe';
    if(!await canRead(candidate,{})){
     // Signals are private to their destination. Require the recipient filter.
     const f=q.where?.fieldFilter;
     if(owner&&['admins','sellerWallets','sellerTransfers','transactions','supportTickets'].includes(path)){}
     else if(path==='supportTickets'&&permission('support')){}
     else if(path==='sellerTransfers'&&q.where?.fieldFilter&&['sellerId','receiverId'].includes(q.where.fieldFilter.field?.fieldPath)&&q.where.fieldFilter.op==='EQUAL'&&decodeValue(q.where.fieldFilter.value)===identity.uid){}
     else if(path==='transactions'&&q.where?.fieldFilter&&['userId','senderId','receiverId'].includes(q.where.fieldFilter.field?.fieldPath)&&q.where.fieldFilter.op==='EQUAL'&&decodeValue(q.where.fieldFilter.value)===identity.uid){}
     else if(!(path.endsWith('/voiceSignals')&&await inRoom(parent.split('/')[1])&&f?.field?.fieldPath==='to'&&f.op==='EQUAL'&&decodeValue(f.value)===identity.uid))fail('permission-denied');
    }
    const rows=(await client.query('select path,fields,updated_at,version from earnbd.social_documents where parent=$1 order by document_id limit 5001',[path])).rows;
    if(rows.length>5000)fail('query-too-large');
    const get=(doc,field)=>field==='__name__'?doc.path:field.split('.').reduce((v,k)=>v?.[k],decodeFields(doc.fields));
    const matches=(row,filter)=>{
     if(!filter)return true;
     if(filter.compositeFilter){if(filter.compositeFilter.op!=='AND'||filter.compositeFilter.filters?.length>10)fail('invalid-argument');return filter.compositeFilter.filters.every(f=>matches(row,f));}
     const f=filter.fieldFilter;if(!f||typeof f.field?.fieldPath!=='string')fail('invalid-argument');
     const a=get(row,f.field.fieldPath),b=decodeValue(f.value);
     switch(f.op){case 'EQUAL':return same(a,b);case 'NOT_EQUAL':return a!==undefined&&!same(a,b);case 'LESS_THAN':return a<b;case 'LESS_THAN_OR_EQUAL':return a<=b;case 'GREATER_THAN':return a>b;case 'GREATER_THAN_OR_EQUAL':return a>=b;case 'IN':return Array.isArray(b)&&b.some(x=>same(a,x));case 'ARRAY_CONTAINS':return Array.isArray(a)&&a.some(x=>same(x,b));default:fail('invalid-argument');}
    };
    let found=rows.filter(r=>matches(r,q.where));
    for(const order of (q.orderBy||[]).slice().reverse()){
     if(typeof order.field?.fieldPath!=='string'||!['ASCENDING','DESCENDING'].includes(order.direction))fail('invalid-argument');
     found=found.filter(r=>get(r,order.field.fieldPath)!==undefined).sort((a,b)=>{const av=get(a,order.field.fieldPath),bv=get(b,order.field.fieldPath);return (av<bv?-1:av>bv?1:0)*(order.direction==='DESCENDING'?-1:1);});
    }
    const limit=q.limit??1000;if(!Number.isInteger(limit)||limit<1||limit>1000)fail('invalid-argument');
    const result=[];
    for(const row of found.slice(0,limit))if(await canRead(row.path,row.fields))result.push({document:wire(row)});
    return result;
   }
   if(data.action!=='commit'||!Array.isArray(data.writes)||!data.writes.length||data.writes.length>25)fail('invalid-argument');
   requireActive();
   const staged=new Map(),oldRows=new Map();const timestamp=new Date(clock()).toISOString();
   for(const w of data.writes){
    const name=w.update?.name||w.delete||w.verify;if(typeof name!=='string'||!name.startsWith(nameRoot+'/'))fail('invalid-argument');
    const path=name.slice(nameRoot.length+1);
    if(!socialPath(path)||path.split('/').length%2!==0||staged.has(path))fail('invalid-argument');
    const old=await read(client,path);oldRows.set(path,old);
    if(w.currentDocument?.exists!==undefined&&Boolean(old)!==w.currentDocument.exists)fail('failed-precondition');
    if(w.currentDocument?.updateTime&&(!old||'version-'+String(old.version)!==w.currentDocument.updateTime))fail('failed-precondition');
    if(w.verify){if(!await canRead(path,old?.fields))fail('permission-denied');continue;}
    if(w.delete){staged.set(path,null);continue;}
    const fields=w.update.fields||{};decodeFields(fields);
    const next=w.updateMask?{...(old?.fields||{})}:{};
    if(w.updateMask){for(const field of w.updateMask.fieldPaths||[]){if(field.includes('.')||['__proto__','constructor','prototype'].includes(field))fail('invalid-argument');if(field in fields)next[field]=fields[field];else delete next[field];}}
    else Object.assign(next,fields);
    for(const transform of w.updateTransforms||[]){if(transform.setToServerValue!=='REQUEST_TIME'||transform.fieldPath.includes('.'))fail('invalid-argument');next[transform.fieldPath]={timestampValue:timestamp};}
    if(JSON.stringify(next).length>700000)fail('invalid-argument');staged.set(path,next);
   }
   const after=async path=>staged.has(path)?decodeFields(staged.get(path)):plain(path);
   for(const [path,fields]of staged){
    const [root,id,sub,child]=path.split('/'),old=decodeFields(oldRows.get(path)?.fields),next=decodeFields(fields),removed=fields===null;
    let permitted=false;
    if(root==='users'&&!sub){
     const keys=changed(old,next);
     permitted=id===identity.uid&&!removed&&Boolean(oldRows.get(path))&&!keys.some(k=>PROTECTED.has(k));
     if(owner&&!removed)permitted=(!keys.includes('coins')||Number.isSafeInteger(next.coins)&&next.coins>=0)&&(!keys.includes('diamond')||Number.isSafeInteger(next.diamond)&&next.diamond>=0);
     if(permission('moderate')&&!removed&&old.email!==OWNER&&keys.every(k=>k==='status')&&['active','banned'].includes(next.status))permitted=true;
     if(permission('seller')&&!removed&&keys.every(k=>['coins','lastSellerTransfer'].includes(k))&&next.lastSellerTransfer){const receipt=await after('sellerTransfers/'+next.lastSellerTransfer),walletBefore=await plain('sellerWallets/'+identity.uid),walletAfter=await after('sellerWallets/'+identity.uid);permitted=receipt.sellerId===identity.uid&&receipt.receiverId===id&&receipt.amount>0&&Number.isSafeInteger(receipt.amount)&&receipt.createdAt===timestamp&&next.coins===old.coins+receipt.amount&&walletAfter.balance===walletBefore.balance-receipt.amount&&walletAfter.balance>=0&&walletAfter.lastTransferId===next.lastSellerTransfer&&receipt.receiverBefore===old.coins&&receipt.receiverAfter===next.coins&&receipt.sellerBefore===walletBefore.balance&&receipt.sellerAfter===walletAfter.balance&&!await read(client,'sellerTransfers/'+next.lastSellerTransfer);}
     if(permitted&&next.photoURL!==undefined&&!photo(next.photoURL))permitted=false;
     if(permitted&&next.currentRoomId){
      const room=await after('rooms/'+next.currentRoomId),control=await after(`rooms/${next.currentRoomId}/controls/${identity.uid}`),role=await after(`rooms/${next.currentRoomId}/roles/${identity.uid}`);
      permitted=!!room.hostId&&control.blocked!==true&&(!room.locked||room.hostId===identity.uid||role.role==='admin'||profile.currentRoomId===next.currentRoomId);
      if(next.roomSeat!==null&&next.roomSeat!==undefined){const count=room.sc||(room.d?12:8),policy=await after(`rooms/${next.currentRoomId}/seatPolicy/config`);permitted=permitted&&Number.isInteger(next.roomSeat)&&next.roomSeat>=0&&next.roomSeat<count&&((old.currentRoomId===next.currentRoomId&&old.roomSeat===next.roomSeat)||!(policy.locked||[]).includes(next.roomSeat));}
     }
    }else if(root==='admins'&&!sub)permitted=owner;
    else if(root==='system'&&!sub)permitted=owner||permission('content')&&((id==='notices'&&changed(old,next).every(k=>k==='items'))||(id==='config'&&changed(old,next).every(k=>['bn','customGifts'].includes(k))));
    else if(root==='assets'&&!sub)permitted=(owner||permission('content'))&&(removed||['frame','entry','banner','gift'].includes(next.kind)&&typeof next.name==='string'&&next.name.length<=80&&typeof next.image==='string'&&next.image.length<=600000&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]*={0,2}$/.test(next.image)&&(next.kind!=='gift'||Number.isSafeInteger(next.price)&&next.price>0));
    else if(root==='sellerWallets'&&!sub){
     permitted=owner&&(!next.balance||Number.isSafeInteger(next.balance)&&next.balance>=0);
     if(!owner&&permission('seller')&&id===identity.uid&&!removed&&changed(old,next).every(k=>['balance','lastTransferId'].includes(k))){const receipt=await after('sellerTransfers/'+next.lastTransferId),recipientBefore=await plain('users/'+receipt.receiverId),recipientAfter=await after('users/'+receipt.receiverId);permitted=receipt.sellerId===identity.uid&&receipt.receiverId!==identity.uid&&Number.isSafeInteger(receipt.amount)&&receipt.amount>0&&next.balance===old.balance-receipt.amount&&next.balance>=0&&recipientAfter.coins===recipientBefore.coins+receipt.amount&&recipientAfter.lastSellerTransfer===next.lastTransferId&&receipt.createdAt===timestamp&&!await read(client,'sellerTransfers/'+next.lastTransferId);}
    }else if(root==='sellerTransfers'&&!sub){
     permitted=owner&&!oldRows.get(path)&&!removed;
     if(permission('seller')&&!oldRows.get(path)&&!removed){const beforeWallet=await plain('sellerWallets/'+identity.uid),afterWallet=await after('sellerWallets/'+identity.uid),beforeUser=await plain('users/'+next.receiverId),afterUser=await after('users/'+next.receiverId);permitted=next.type==='transfer'&&next.sellerId===identity.uid&&next.receiverId!==identity.uid&&Number.isSafeInteger(next.amount)&&next.amount>0&&beforeWallet.balance>=next.amount&&afterWallet.balance===beforeWallet.balance-next.amount&&afterWallet.lastTransferId===id&&afterUser.coins===beforeUser.coins+next.amount&&afterUser.lastSellerTransfer===id&&next.createdAt===timestamp&&!['banned','archived'].includes(beforeUser.status);}
    }else if(root==='transactions'&&!sub)permitted=owner&&!removed&&!oldRows.get(path);
    else if(root==='supportTickets'){
     const access=id===identity.uid||owner||permission('support');
     if(!sub)permitted=access&&(removed?owner:allowed(next,['userId','name','updatedAt','lastMessage','status'])&&next.userId===id&&typeof next.name==='string'&&typeof next.lastMessage==='string'&&next.lastMessage.length<=120);
     else if(sub==='messages')permitted=access&&(removed?owner:!oldRows.get(path)&&allowed(next,['senderId','kind','text','image','createdAt'])&&next.senderId===identity.uid&&next.createdAt===timestamp&&typeof next.text==='string'&&next.text.length<=3000&&typeof next.image==='string'&&next.image.length<=600000&&(!next.image||/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]*={0,2}$/.test(next.image))&&(id===identity.uid&&next.kind==='customer'||(owner||permission('support'))&&next.kind==='staff'));
    }else if(root==='users'&&sub==='roomLibrary')permitted=id===identity.uid&&(removed||allowed(next,['visitedAt','followed'])&&(next.followed===undefined||typeof next.followed==='boolean')&&(next.visitedAt===undefined||fields.visitedAt?.timestampValue));
    else if(root==='users'&&sub==='visitors')permitted=!removed&&id!==identity.uid&&child===identity.uid&&allowed(next,['visitorId','createdAt'])&&next.visitorId===identity.uid&&next.createdAt===timestamp;
    else if(root==='roomOwners'&&!sub)permitted=!oldRows.get(path)&&!removed&&id===identity.uid&&allowed(next,['roomId'])&&next.roomId==='user-'+id&&(await after('rooms/'+next.roomId)).hostId===id;
    else if(root==='rooms'&&!sub){
     permitted=owner||(oldRows.get(path)?await roomOwner(id)&&(removed||next.hostId===old.hostId):!removed&&id==='user-'+identity.uid&&next.hostId===identity.uid&&(await after('roomOwners/'+identity.uid)).roomId===id);
     if(!removed&&next.photoURL!==undefined&&!photo(next.photoURL))permitted=false;
    }else if(root==='rooms'){
     if(sub==='roles')permitted=await roomOwner(id)&&(removed||child!==(await plain('rooms/'+id)).hostId&&allowed(next,['role','canLockSeats'])&&next.role==='admin'&&(next.canLockSeats===undefined||typeof next.canLockSeats==='boolean'));
     if(sub==='controls')permitted=removed?await roomOwner(id):await roomAdmin(id)&&child!==(await plain('rooms/'+id)).hostId&&(await roomOwner(id)||!(await plain(`rooms/${id}/roles/${child}`)).role)&&allowed(next,['muted','blocked'])&&typeof next.muted==='boolean'&&typeof next.blocked==='boolean';
     if(sub==='seatPolicy'){const ownRole=await plain(`rooms/${id}/roles/${identity.uid}`);permitted=removed?await roomOwner(id):child==='config'&&(await roomOwner(id)||ownRole.role==='admin'&&ownRole.canLockSeats===true)&&allowed(next,['locked','updatedBy','updatedAt'])&&Array.isArray(next.locked)&&next.locked.length<=20&&next.locked.every(v=>Number.isInteger(v)&&v>=0&&v<20)&&next.updatedBy===identity.uid&&next.updatedAt===timestamp;}
     if(sub==='chat')permitted=removed?await roomOwner(id)||owner:!oldRows.get(path)&&await inRoom(id)&&allowed(next,['senderId','senderName','text','createdAt'])&&next.senderId===identity.uid&&next.senderName===profile.name&&typeof next.text==='string'&&next.text.length>0&&next.text.length<=1000&&next.createdAt===timestamp;
     if(sub==='voicePeers'){
      const room=await plain('rooms/'+id),control=await plain(`rooms/${id}/controls/${identity.uid}`),seat=profile.roomSeat;
      permitted=child===identity.uid&&(removed||await inRoom(id)&&allowed(next,['session','speaking','updatedAt'])&&typeof next.session==='string'&&next.session.length<80&&typeof next.speaking==='boolean'&&next.updatedAt===timestamp&&(!next.speaking||Number.isInteger(seat)&&seat>=0&&seat<(room.sc||(room.d?12:8))&&control.muted!==true));
     }
     if(sub==='voiceSignals')permitted=removed?(old.to===identity.uid||old.from===identity.uid):!oldRows.get(path)&&await inRoom(id)&&allowed(next,['from','to','type','payload','fromSession','toSession','createdAt'])&&next.from===identity.uid&&['offer','answer','candidate'].includes(next.type)&&typeof next.payload==='string'&&next.payload.length<=30000&&next.createdAt===timestamp&&(await plain('users/'+next.to)).currentRoomId===id;
    }else if(root==='follows'&&!sub)permitted=removed?old.followerId===identity.uid:!oldRows.get(path)&&allowed(next,['followerId','followingId','createdAt'])&&next.followerId===identity.uid&&next.followingId!==identity.uid&&id===identity.uid+'~'+next.followingId&&next.createdAt===timestamp&&!!await read(client,'users/'+next.followingId);
    else if(root==='moments'&&!sub)permitted=removed?owner||old.userId===identity.uid:!oldRows.get(path)&&allowed(next,['userId','text','name','avatar','createdAt'])&&next.userId===identity.uid&&typeof next.text==='string'&&next.text.length>0&&next.text.length<=2000&&typeof next.name==='string'&&next.name.length<=100&&typeof next.avatar==='string'&&next.avatar.length<=300000&&next.createdAt===timestamp;
    if(!permitted)fail('permission-denied');
   }
   for(const [path,fields]of staged){
    if(fields===null){await client.query('delete from earnbd.social_documents where path=$1',[path]);continue;}
    const parts=path.split('/'),id=parts.pop(),parent=parts.join('/');
    await client.query('insert into earnbd.social_documents(path,parent,document_id,fields,updated_at) values($1,$2,$3,$4::jsonb,$5) on conflict(path) do update set fields=excluded.fields,version=social_documents.version+1,updated_at=excluded.updated_at',[path,parent,id,JSON.stringify(fields),timestamp]);
   }
   return {commitTime:timestamp};
  });
 }
 async function account(_data,identity){
  return database.transaction(async client=>{
   const path='users/'+identity.uid,existing=await read(client,path),old=decodeFields(existing?.fields);
   if(['banned','archived'].includes(old.status))fail('inactive-user');
   const owner=identity.email_verified===true&&identity.email?.toLowerCase()===OWNER;
   const name=String(identity.name||identity.email?.split('@')[0]||'User').slice(0,80);
   let fields=existing?.fields;
   if(!existing){
    const publicId=String(randomInt(100000000,1000000000));
    const collision=await client.query("select path from earnbd.social_documents where parent='users' and fields->'id'->>'stringValue'=$1",[publicId]);
    if(collision.rowCount)fail('failed-precondition');
    fields=encodeFields({id:publicId,userId:identity.uid,name,email:identity.email||'',photoURL:typeof identity.picture==='string'&&identity.picture.startsWith('https://')?identity.picture:'',avatar:'👤',coins:50000,role:owner?'admin':'user',status:'active',createdAt:new Date(clock()),online:true,currentRoomId:null,roomSeat:null,lastSeen:new Date(clock())});
   }else fields={...fields,...encodeFields({online:true,currentRoomId:null,roomSeat:null,lastSeen:new Date(clock())})};
   await client.query("insert into earnbd.social_documents(path,parent,document_id,fields) values($1,'users',$2,$3::jsonb) on conflict(path) do update set fields=excluded.fields,updated_at=now(),version=social_documents.version+1",[path,identity.uid,JSON.stringify(fields)]);
   const user=decodeFields(fields);return {...user,role:owner?'admin':'user',coins:Number(user.coins||0)};
  });
 }
 async function voiceConfig(data,uid){
  return database.transaction(async client=>{
   const user=decodeFields((await read(client,'users/'+uid))?.fields),control=decodeFields((await read(client,`rooms/${data.roomId}/controls/${uid}`))?.fields);
   if(!user.id||['banned','archived'].includes(user.status)||user.currentRoomId!==data.roomId||control.blocked)fail('inactive-user');
   const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}];
   const secret=process.env.TURN_SHARED_SECRET,urls=process.env.TURN_URLS?.split(',').map(s=>s.trim()).filter(Boolean);
   if(secret&&urls?.length){const username=`${Math.floor(clock()/1000)+3600}:${uid}`;iceServers.push({urls,username,credential:createHmac('sha1',secret).update(username).digest('base64')});}
   return {iceServers,relayEnabled:!!secret&&!!urls?.length};
  });
 }
 return {social,account,voiceConfig};
}
