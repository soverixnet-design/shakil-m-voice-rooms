import {FieldPath,FieldValue} from 'firebase-admin/firestore';

export function firestoreValue(value) {
  if(value===null)return {nullValue:null};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if(value?.isEqual?.(FieldValue.serverTimestamp()))return {timestampValue:new Date().toISOString()};
  if(value?.toDate)return {timestampValue:value.toDate().toISOString()};
  if(value instanceof Date)return {timestampValue:value.toISOString()};
  if(Array.isArray(value))return {arrayValue:{values:value.map(firestoreValue)}};
  if(value&&typeof value==='object')return {mapValue:{fields:encodeFields(value)}};
  throw Error('unsupported-migration-value');
}
export const encodeFields=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,firestoreValue(v)]));
export function decodeValue(value){
  if(value==null)return null;
  if('stringValue' in value)return value.stringValue;
  if('booleanValue' in value)return value.booleanValue;
  if('integerValue' in value)return Number(value.integerValue);
  if('doubleValue' in value)return Number(value.doubleValue);
  if('timestampValue' in value)return value.timestampValue;
  if('nullValue' in value)return null;
  if(value.arrayValue)return (value.arrayValue.values||[]).map(decodeValue);
  if(value.mapValue)return decodeFields(value.mapValue.fields||{});
  throw Error('invalid-argument');
}
export const decodeFields=fields=>Object.fromEntries(Object.entries(fields||{}).map(([k,v])=>[k,decodeValue(v)]));

// Copy persistent social data only. Never change or delete the Firebase source.
// Conflict handling preserves newer Supabase writes across deploys and retries.
export async function migrateSocialData(source,database){
  const client=await database.pool.connect();
  let locked=false;let copied=0;
  async function scan(collection){
    let last;
    for(;;){
      let query=collection.orderBy(FieldPath.documentId()).limit(100);
      if(last)query=query.startAfter(last);
      const batch=await query.get();
      if(batch.empty)break;
      for(const document of batch.docs){
        const path=document.ref.path,parts=path.split('/'),id=parts.pop(),parent=parts.join('/');
        const result=await client.query('insert into earnbd.social_documents(path,parent,document_id,fields) values($1,$2,$3,$4::jsonb) on conflict(path) do nothing',[path,parent,id,JSON.stringify(encodeFields(document.data()))]);
        copied+=result.rowCount;
        const subcollections=parent==='users'?['roomLibrary','visitors']:parent==='rooms'?['roles','controls','seatPolicy','chat','giftEvents']:parent==='supportTickets'?['messages']:[];
        for(const name of subcollections)await scan(document.ref.collection(name));
      }
      last=batch.docs.at(-1);
      if(batch.size<100)break;
    }
  }
  try{
    locked=(await client.query('select pg_try_advisory_lock(71938104) as locked')).rows[0].locked;
    if(!locked)throw Error('migration-already-running');
    const marker=await client.query("select path from earnbd.social_documents where path='migration/social-v1'");
    if(marker.rowCount)return {status:'already-complete',copied:0};
    for(const name of ['users','rooms','roomOwners','follows','moments','admins','diamondWallets','walletRequests','transactions','assets','system','supportTickets','sellerWallets','sellerTransfers'])await scan(source.collection(name));
    await client.query("insert into earnbd.social_documents(path,parent,document_id,fields) values('migration/social-v1','migration','social-v1',$1::jsonb) on conflict(path) do nothing",[JSON.stringify(encodeFields({completedAt:new Date(),copied}))]);
    return {status:'complete',copied};
  }finally{
    if(locked)await client.query('select pg_advisory_unlock(71938104)').catch(()=>{});
    client.release();
  }
}
