import {decodeFields,encodeFields} from './social-migration.js';
// One dispatcher per process. Notification tags also deduplicate a retry after a lost FCM response.
export function createPushDispatcher(database,messaging,clock=Date.now){
 let running=false;
 return async function dispatch(){
  if(running)return;running=true;
  try{
   const rows=(await database.pool.query("select path,fields from earnbd.social_documents where parent='pushOutbox' and fields->'status'->>'stringValue'='pending' and coalesce((fields->'nextAttemptAt'->>'integerValue')::bigint,0)<=$1 order by updated_at limit 30",[clock()])).rows;
   for(const row of rows){
    const job=decodeFields(row.fields);if(job.nextAttemptAt>clock())continue;
    try{
     const devices=(await database.pool.query("select path,fields from earnbd.social_documents where parent='pushDevices' and fields->'userId'->>'stringValue'=$1 limit 20",[job.userId])).rows;
     const sender=(await database.pool.query('select fields from earnbd.social_documents where path=$1',['users/'+job.senderId])).rows[0];
     const title=String(decodeFields(sender?.fields).name||'EarnBD').slice(0,80);
     const results=await Promise.all(devices.map(async device=>{const d=decodeFields(device.fields);try{await messaging.send({token:d.token,data:{type:'direct-message',uid:job.userId,senderId:job.senderId,messageId:job.messageId,title,body:'আপনাকে একটি মেসেজ পাঠিয়েছেন।'},android:{priority:'high',ttl:86400000,collapseKey:'dm-'+job.senderId}});return true}catch(error){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)){await database.pool.query('delete from earnbd.social_documents where path=$1 and fields=$2::jsonb',[device.path,JSON.stringify(device.fields)]);return true}throw error;}}));
     if(results.every(Boolean))await update(row,{...job,status:'sent',sentAt:clock()});
    }catch(error){const attempts=Number(job.attempts||0)+1;await update(row,{...job,attempts,status:attempts>=8?'failed':'pending',nextAttemptAt:clock()+Math.min(300000,10000*2**attempts),error:String(error.code||'push-unavailable').slice(0,100)});console.error('Message notification retry:',error.code||'push-unavailable');}
   }
  }finally{running=false;}
 };
 async function update(row,data){await database.pool.query('update earnbd.social_documents set fields=$2::jsonb,updated_at=now(),version=version+1 where path=$1',[row.path,JSON.stringify(encodeFields(data))]);}
}
