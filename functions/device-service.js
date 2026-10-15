import {createHash} from 'node:crypto';
import {decodeFields,encodeFields} from './social-migration.js';
const OWNER='yfastvpn@gmail.com';
const fail=code=>{throw Object.assign(Error(code),{code})};
export function createDeviceService(database){
 const read=async(c,path)=>decodeFields((await c.query('select path,fields from earnbd.social_documents where path=$1',[path])).rows[0]?.fields);
 const write=async(c,path,value)=>{const parts=path.split('/');await c.query('insert into earnbd.social_documents(path,parent,document_id,fields,updated_at) values($1,$2,$3,$4::jsonb,$5) on conflict(path) do update set fields=excluded.fields,version=social_documents.version+1,updated_at=excluded.updated_at',[path,parts.slice(0,-1).join('/'),parts.at(-1),JSON.stringify(encodeFields(value)),new Date()])};
 const owner=i=>i.email_verified===true&&i.email?.toLowerCase()===OWNER;
 return {
 async checkDevice(identity,raw){
  if(typeof raw!=='string'||!/^install-[a-f0-9-]{36}$/.test(raw)){if(owner(identity))return;fail('device-required')}
  const key=createHash('sha256').update(raw).digest('hex');
  await database.transaction(async c=>{
   const device=await read(c,'deviceRegistry/'+key);
   if(device.banned&&!owner(identity))fail('device-banned');
   const link=await read(c,'userDevices/'+identity.uid+'/devices/'+key);
   if(!link.key)await write(c,'userDevices/'+identity.uid+'/devices/'+key,{key,registeredAt:new Date()});
   if(!device.key)await write(c,'deviceRegistry/'+key,{key,banned:false,registeredAt:new Date()});
  });
 },
 async devices(data,identity){return database.transaction(async c=>{
  const actor=await read(c,'users/'+identity.uid),grant=await read(c,'admins/'+identity.uid);
  if(!owner(identity)&&(!actor.id||['banned','archived'].includes(actor.status)||!grant.active||!grant.permissions?.moderate))fail('permission-denied');
  if(typeof data.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.uid)||!['list','ban','unban'].includes(data.action))fail('invalid-argument');
  const target=await read(c,'users/'+data.uid);
  if(!target.id||target.email?.toLowerCase()===OWNER||data.uid===identity.uid)fail('permission-denied');
  const links=(await c.query('select path,fields from earnbd.social_documents where parent=$1',['userDevices/'+data.uid+'/devices'])).rows;
  const devices=[];
  for(const row of links){const {key}=decodeFields(row.fields);if(!/^[a-f0-9]{64}$/.test(key||''))continue;let device=await read(c,'deviceRegistry/'+key);
   if(data.action!=='list'){device={...device,key,banned:data.action==='ban',reason:String(data.reason||'').slice(0,300),changedBy:identity.uid,changedAt:new Date()};await write(c,'deviceRegistry/'+key,device)}
   devices.push({key,banned:!!device.banned,reason:device.reason||''});
  }
  return {devices};
 })}
 };
}
