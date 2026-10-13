import {Timestamp} from 'firebase-admin/firestore';
import {encodeFields,decodeValue} from './social-migration.js';
const roots=new Set(['users','diamondWallets','walletRequests','transactions','rooms','system','assets']);
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
  if(typeof path!=='string'||!path||path.split('/').some(v=>!v))throw Error('invalid-request');
  if(!roots.has(path.split('/')[0]))return source.doc(path);
  const ref={path,id:path.split('/').at(-1),get:()=>read(database.pool,ref)};return ref;
 };
 const collection=path=>{if(!roots.has(path))return source.collection(path);const build=(filters=[])=>({where:(field,op,value)=>{if(op!=='==')throw Error('invalid-request');return build([...filters,[field,value]])},get:async()=>{const rows=(await database.pool.query('select path,fields from earnbd.social_documents where parent=$1',[path])).rows;const docs=rows.map(row=>snapshot(doc(row.path),row)).filter(s=>filters.every(([field,value])=>s.data()?.[field]===value));return {docs,empty:!docs.length,size:docs.length}}});return build();};
 return {doc,collection,runTransaction:work=>database.transaction(async client=>{
  const writes=[];
  const result=await work({get:ref=>read(client,ref),set:(ref,data,options)=>writes.push({ref,data,merge:options?.merge===true}),update:(ref,data)=>writes.push({ref,data,merge:true,exists:true})});
  for(const write of writes){
   if(!roots.has(write.ref.path.split('/')[0]))throw Error('invalid-request');
   const current=await read(client,write.ref);
   if(write.exists&&!current.exists)throw Error('inactive-user');
   const data=write.merge?{...(current.data()||{}),...write.data}:write.data;
   const parts=write.ref.path.split('/'),id=parts.pop(),parent=parts.join('/');
   await client.query('insert into earnbd.social_documents(path,parent,document_id,fields) values($1,$2,$3,$4::jsonb) on conflict(path) do update set fields=excluded.fields,updated_at=now(),version=social_documents.version+1',[write.ref.path,parent,id,JSON.stringify(encodeFields(data))]);
  }
  return result;
 })};
}
