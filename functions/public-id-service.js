import {decodeFields,encodeFields} from './social-migration.js';
export const PUBLIC_ID_COUNTER='system/publicIdSequence';
export const firstPublicId=100001,lastPublicId=999999;
export async function retryPublicIdTransaction(database,work){
 for(let attempt=0;;attempt++){
  try{return await database.transaction(work)}catch(error){
   if(!['40001','40P01'].includes(error.code)||attempt>=7)throw error;
   await new Promise(resolve=>setTimeout(resolve,10*(attempt+1)));
  }
 }
}
const save=(client,path,fields)=>client.query('insert into earnbd.social_documents(path,parent,document_id,fields) values($1,$2,$3,$4::jsonb) on conflict(path) do update set fields=excluded.fields,updated_at=now(),version=social_documents.version+1',[path,path.slice(0,path.lastIndexOf('/')),path.split('/').at(-1),JSON.stringify(fields)]);
// One atomic conversion. Preserve internal UIDs, balances, memberships and historical receipts.
export async function migratePublicIds(database){
 return retryPublicIdTransaction(database,async client=>{
  await client.query('lock table earnbd.social_documents in share row exclusive mode');
  const marker=(await client.query('select path,fields from earnbd.social_documents where path=$1',[PUBLIC_ID_COUNTER])).rows[0];
  if(decodeFields(marker?.fields).migrationVersion===1)return {alreadyMigrated:true};
  const users=(await client.query('select path,fields from earnbd.social_documents where parent=$1',['users'])).rows;
  const times=new Map(users.map(row=>{const time=Date.parse(decodeFields(row.fields).createdAt);if(!Number.isFinite(time))throw Error('public-id-creation-time-missing');return [row.path,time];}));
  users.sort((a,b)=>times.get(a.path)-times.get(b.path)||a.path.localeCompare(b.path));
  if(users.length>lastPublicId-firstPublicId+1)throw Error('public-id-capacity-exhausted');
  const ids=new Map();
  for(let index=0;index<users.length;index++){
   const row=users[index],old=decodeFields(row.fields),id=String(firstPublicId+index);
   ids.set(row.path.split('/')[1],id);
   await save(client,row.path,{...row.fields,...encodeFields({id,...(old.id&&String(old.id)!==id?{legacyPublicId:String(old.id)}:{})})});
  }
  const rooms=(await client.query('select path,fields from earnbd.social_documents where parent=$1',['rooms'])).rows;
  let updatedRooms=0;
  for(const row of rooms){const id=ids.get(decodeFields(row.fields).hostId);if(id){await save(client,row.path,{...row.fields,...encodeFields({publicId:id})});updatedRooms++;}}
  await save(client,PUBLIC_ID_COUNTER,encodeFields({migrationVersion:1,next:firstPublicId+users.length,migratedAt:new Date(),users:users.length}));
  return {users:users.length,rooms:updatedRooms,next:firstPublicId+users.length};
 });
}
export async function allocatePublicId(client){
 const row=(await client.query('select path,fields from earnbd.social_documents where path=$1 for update',[PUBLIC_ID_COUNTER])).rows[0];
 const state=decodeFields(row?.fields),next=state.next;
 if(state.migrationVersion!==1)throw Error('public-id-migration-required');
 if(!Number.isSafeInteger(next)||next<firstPublicId||next>lastPublicId)throw Object.assign(Error('public-id-capacity-exhausted'),{code:'resource-exhausted'});
 await save(client,PUBLIC_ID_COUNTER,{...row.fields,...encodeFields({next:next+1})});
 return String(next);
}
