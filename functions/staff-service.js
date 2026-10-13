import {createHash} from 'node:crypto';
import {encodeFields,decodeFields} from './social-migration.js';
const permissions=['content','support','moderate','seller','events'];
export function validateStaff(data){
 const username=String(data.username||'').trim().toLowerCase(),password=String(data.password||''),name=String(data.name||'').trim();
 if(!/^[a-z][a-z0-9_]{3,31}$/.test(username)||password.length<12||password.length>128||!name||name.length>80||!['super_admin','admin','bd_admin'].includes(data.role))throw Object.assign(Error('invalid-staff'),{code:'invalid-argument'});
 return {username,password,name,role:data.role,permissions:Object.fromEntries(permissions.map(k=>[k,data.permissions?.[k]===true]))};
}
export function createStaffService(database,auth,clock=Date.now){
 return {staff:async(data,identity)=>{
  if(identity?.email_verified!==true||identity.email?.toLowerCase()!=='yfastvpn@gmail.com')throw Object.assign(Error('permission-denied'),{code:'permission-denied'});
  if(data.action!=='save')throw Object.assign(Error('invalid-request'),{code:'invalid-argument'});
  const input=validateStaff(data),uid='staff_'+createHash('sha256').update(input.username).digest('hex').slice(0,32),email=input.username+'@staff.earnbd.work';
  // Disable during configuration so a partial failure cannot grant new access.
  try{await auth.getUser(uid);await auth.updateUser(uid,{password:input.password,displayName:input.name,disabled:true});await auth.revokeRefreshTokens(uid)}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid,email,password:input.password,displayName:input.name,disabled:true})}
  await database.transaction(async client=>{
   const read=async path=>decodeFields((await client.query('select fields from earnbd.social_documents where path=$1',[path])).rows[0]?.fields);
   const put=async(path,value)=>{const parts=path.split('/'),id=parts.pop();await client.query('insert into earnbd.social_documents(path,parent,document_id,fields,updated_at) values($1,$2,$3,$4::jsonb,$5) on conflict(path) do update set fields=excluded.fields,version=social_documents.version+1,updated_at=excluded.updated_at',[path,parts.join('/'),id,JSON.stringify(encodeFields(value)),new Date(clock()).toISOString()])};
   const old=await read('users/'+uid);
   await put('users/'+uid,{...old,id:old.id||'S'+uid.slice(6,14),userId:uid,email,name:input.name,avatar:old.avatar||'👤',coins:old.coins||0,status:'active',role:'user',createdAt:old.createdAt||new Date(clock())});
   await put('admins/'+uid,{active:true,username:input.username,role:input.role,name:input.name,publicId:old.id||'S'+uid.slice(6,14),permissions:input.permissions,grantedBy:identity.uid,updatedAt:new Date(clock())});
  });
  await auth.updateUser(uid,{disabled:false});return {uid,username:input.username};
 }};
}
