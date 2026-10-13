import {decodeFields,encodeFields} from './social-migration.js';
const active=u=>u&&!['banned','archived'].includes(u.status);
export function createReferralService(store){
 return {referral:async(data,identity)=>store.runTransaction(async tx=>{
  const own=store.doc('users/'+identity.uid),snap=await tx.get(own),user=snap.data();
  if(!active(user))throw Object.assign(Error('permission-denied'),{code:'permission-denied'});
  if(data.action==='summary')return {ref:user.referrerUid?user.ref:'',inv:user.referralStats||{n:0,earn:0,list:[]}};
  const code=String(data.code||'').trim().toUpperCase();
  if(data.action!=='claim'||!/^SM\d{6,12}$/.test(code))throw Error('invalid-request');
  if(code==='SM'+user.id)throw Error('self-referral');
  if(user.referrerUid){if(user.ref===code)return {ref:user.ref};throw Error('referral-already-set');}
  const found=await tx.get(store.collection('users').where('id','==',code.slice(2)));
  const inviter=found.docs.find(x=>active(x.data()));
  if(!inviter)throw Error('referral-not-found');
  // Prevent cycles, including longer existing referral chains.
  let ancestor=inviter.id;const visited=new Set();
  while(ancestor){if(ancestor===identity.uid||visited.has(ancestor))throw Error('self-referral');visited.add(ancestor);if(visited.size>100)throw Error('invalid-request');const next=await tx.get(store.doc('users/'+ancestor));ancestor=next.data()?.referrerUid;}
  const stats=inviter.data().referralStats||{n:0,earn:0,list:[]};
  tx.update(own,{ref:code,referrerUid:inviter.id,referralAt:new Date()});
  tx.update(inviter.ref,{referralStats:{...stats,n:Number(stats.n||0)+1}});
  return {ref:code};
 })};
}
// Runs inside the same serializable transaction as an approved admin recharge.
export async function applyReferralRewards({client,staged,oldRows,read,timestamp}){
 const changes=[...staged];
 for(const [path,fields]of changes){
  if(!path.startsWith('transactions/')||!fields||oldRows.get(path))continue;
  const receipt=decodeFields(fields);if(receipt.type!=='admin-recharge'||!Number.isSafeInteger(receipt.amount)||receipt.amount<=0)continue;
  const userPath='users/'+receipt.userId,userFields=staged.get(userPath),before=decodeFields(oldRows.get(userPath)?.fields),after=decodeFields(userFields);
  if(!userFields||!before.referrerUid||after.coins-before.coins!==receipt.amount||after.totalRecharged-before.totalRecharged!==receipt.amount)continue;
  const inviterPath='users/'+before.referrerUid,inviterRow=await read(client,inviterPath),inviter=decodeFields(staged.get(inviterPath)||inviterRow?.fields);
  if(!active(inviter)||before.referrerUid===receipt.userId)continue;
  const config=decodeFields((await read(client,'system/config'))?.fields),percent=Number(config.invPct??5);
  if(!Number.isFinite(percent)||percent<0||percent>100)throw Error('invalid-request');
  const reward=Math.floor(receipt.amount*percent/100);if(!reward)continue;
  const stats=inviter.referralStats||{n:0,earn:0,list:[]},balance=Number(inviter.coins||0)+reward,earn=Number(stats.earn||0)+reward;
  if(!Number.isSafeInteger(balance)||!Number.isSafeInteger(earn))throw Error('invalid-request');
  staged.set(inviterPath,{...(staged.get(inviterPath)||inviterRow.fields),...encodeFields({coins:balance,referralStats:{...stats,earn,list:[{n:before.name||'User',c:receipt.amount,r:reward,id:path},...(stats.list||[])].slice(0,100)}})});
  const id='referral_'+path.split('/')[1];staged.set('transactions/'+id,encodeFields({type:'referral-reward',userId:before.referrerUid,sourceUserId:receipt.userId,sourceTransaction:path,amount:reward,percent,balance,createdAt:timestamp}));
 }
}
