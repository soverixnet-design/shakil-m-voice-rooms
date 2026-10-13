import {Timestamp} from 'firebase-admin/firestore';
import {encodeFields,decodeValue} from './social-migration.js';
const roots=new Set(['users','userPublicIds','diamondWallets','walletRequests','transactions','rooms','system','assets','sharedGames','gameSecrets','gameRanks','gameRequests','gameReceipts','gameWins']);
function unpack(value){
 if(value?.timestampValue)return Timestamp.fromDate(new Date(value.timestampValue));
 if(value?.mapValue)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,unpack(v)]));
 if(value?.arrayValue)return (value.arrayValue.values||[]).map(unpack);
 return decodeValue(value);
}
export function createSocialWalletStore(database,source){
 const snapshot=(ref,row)=>({ref,id:ref.id,exists:!!row,data:()=>row?Object.fromEntries(Object.entries(row.fields).map(([k,v])=>[k,unpack(v)])):undefined});
 async function read(client,ref){return snapshot(ref,(await client.query('select fields from earnbd.social_documents where path=$1',[ref.path])).rows[0]);}
 const doc=path=>{
  if(typeof path!=='string'||!path||path.split('/').some(v=>!v)||path.split('/').length%2!==0||!roots.has(path.split('/')[0]))throw Error('invalid-request');
  const ref={path,id:path.split('/').at(-1),get:()=>read(database.pool,ref),collection:name=>collection(path+'/'+name),update:data=>runTransaction(t=>t.update(ref,data)),set:(data,options)=>runTransaction(t=>t.set(ref,data,options))};return ref;
 };
 const collection=path=>{
  if(!roots.has(path.split('/')[0])||path.split('/').length%2!==1)throw Error('invalid-request');
  const build=(filters=[],cap=Infinity)=>({path,kind:'query',doc:id=>doc(path+'/'+id),where:(field,op,value)=>{
   if(!['==','in'].includes(op))throw Error('invalid-request');return build([...filters,[field,op,value]],cap);
  },limit:n=>build(filters,n),get:()=>readQuery(database.pool,path,filters,cap),filters,cap});return build();
 };
 async function readQuery(client,path,filters,cap){
  const rows=(await client.query('select path,fields from earnbd.social_documents where parent=$1',[path])).rows;
  const docs=rows.map(row=>snapshot(doc(row.path),row)).filter(s=>filters.every(([field,op,value])=>op==='in'?value.includes(s.data()?.[field]):s.data()?.[field]===value)).slice(0,cap);
  return {docs,empty:!docs.length,size:docs.length};
 }
 const runTransaction=async work=>{
  for(let attempt=0;;attempt++)try{return await database.transaction(async client=>{
   const writes=[];
   const result=await work({get:ref=>ref.kind==='query'?readQuery(client,ref.path,ref.filters,ref.cap):read(client,ref),set:(ref,data,options)=>writes.push({ref,data,merge:options?.merge===true}),create:(ref,data)=>writes.push({ref,data,create:true}),update:(ref,data)=>writes.push({ref,data,merge:true,exists:true})});
   for(const write of writes){
    if(!roots.has(write.ref.path.split('/')[0]))throw Error('invalid-request');
    const current=await read(client,write.ref);
    if(write.exists&&!current.exists)throw Error('inactive-user');
    if(write.create&&current.exists)throw Object.assign(Error('already-exists'),{code:'already-exists'});
    const data=write.merge?{...(current.data()||{}),...write.data}:write.data;
    const parts=write.ref.path.split('/'),id=parts.pop(),parent=parts.join('/');
    await client.query('insert into earnbd.social_documents(path,parent,document_id,fields) values($1,$2,$3,$4::jsonb) on conflict(path) do update set fields=excluded.fields,updated_at=now(),version=social_documents.version+1',[write.ref.path,parent,id,JSON.stringify(encodeFields(data))]);
   }
   return result;
  });}catch(error){if(!['40001','40P01','23505'].includes(error.code)||attempt>=4)throw error;}
 };
 return {doc,collection,runTransaction};
}
