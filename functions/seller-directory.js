import {decodeFields} from './social-migration.js';
const deny=()=>{throw Object.assign(Error('permission-denied'),{code:'permission-denied'})};
export function createSellerDirectoryService(database){
 return {sellers:async(data,identity)=>{
  if(!identity?.uid)deny();
  if(data.action!=='list')throw Object.assign(Error('invalid-request'),{code:'invalid-argument'});
  return database.transaction(async client=>{
   const own=decodeFields((await client.query('select fields from earnbd.social_documents where path=$1',['users/'+identity.uid])).rows[0]?.fields);
   if(!own.id||['banned','archived'].includes(own.status))deny();
   const grants=(await client.query("select path,fields from earnbd.social_documents where parent=$1 and fields->'active'->>'booleanValue'='true' and fields->'permissions'->'mapValue'->'fields'->'seller'->>'booleanValue'='true' order by document_id limit 1001",['admins'])).rows;
   if(grants.length>1000)throw Object.assign(Error('query-too-large'),{code:'query-too-large'});
   const ids=grants.map(g=>g.path.split('/')[1]);if(!ids.length)return {rows:[],mine:null};
   const paths=ids.flatMap(id=>['users/'+id,'sellerWallets/'+id]);
   const profiles=new Map((await client.query('select path,fields from earnbd.social_documents where path=ANY($1::text[])',[paths])).rows.map(r=>[r.path,decodeFields(r.fields)]));
   const totals=(await client.query("select fields->'sellerId'->>'stringValue' as seller_id, count(*)::int as transfers, coalesce(sum(coalesce(fields->'amount'->>'integerValue',fields->'amount'->>'doubleValue')::numeric),0)::text as sent from earnbd.social_documents where parent=$1 and fields->'type'->>'stringValue'='transfer' and fields->'sellerId'->>'stringValue'=ANY($2::text[]) group by fields->'sellerId'->>'stringValue'",['sellerTransfers',ids])).rows;
   const stats=new Map(totals.map(r=>[r.seller_id,r]));
   const rows=grants.flatMap(g=>{
    const uid=g.path.split('/')[1],user=profiles.get('users/'+uid),grant=decodeFields(g.fields),wallet=profiles.get('sellerWallets/'+uid)||{},stat=stats.get(uid)||{};
    if(!user?.id||['banned','archived'].includes(user.status))return [];
    // Public business card only: never return email, private wallet, permissions or passwords.
    return [{uid,id:String(user.id),name:String(user.name||grant.name||'Seller').slice(0,80),avatar:user.photoURL||user.avatar||'👤',balance:Number(wallet.balance||0),sent:Number(stat.sent||0),transfers:Number(stat.transfers||0),description:String(grant.sellerBio||'রিচার্জের জন্য মেসেজ করুন।').slice(0,500),since:grant.updatedAt?.toDate?.().toISOString()||null}];
   }).sort((a,b)=>a.name.localeCompare(b.name));
   return {rows,mine:rows.find(r=>r.uid===identity.uid)||null};
  });
 }};
}
