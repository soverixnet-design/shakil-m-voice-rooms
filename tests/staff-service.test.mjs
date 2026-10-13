import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaffService,validateStaff} from '../functions/staff-service.js';
import {decodeFields} from '../functions/social-migration.js';
const data={action:'save',username:'bd_admin',password:'a-long-password-123',name:'BD Staff',role:'bd_admin',permissions:{content:true,support:true,events:false,owner:true}};
test('staff validation whitelists permissions and rejects weak passwords',()=>{assert.deepEqual(validateStaff(data).permissions,{content:true,support:true,events:false,moderate:false,seller:false});assert.throws(()=>validateStaff({...data,password:'123'}));assert.throws(()=>validateStaff({...data,username:'../owner'}));});
test('only verified owner creates staff and passwords never enter stored profile or grant',async()=>{
 const records=new Map(),calls=[];const database={transaction:fn=>fn({query:async(sql,args)=>{if(sql.startsWith('select'))return {rows:records.has(args[0])?[{fields:records.get(args[0])}]:[]};records.set(args[0],JSON.parse(args[3]));return {rows:[]}}})};
 const auth={getUser:async()=>{throw Object.assign(Error(),{code:'auth/user-not-found'})},createUser:async user=>calls.push(user),updateUser:async(uid,value)=>calls.push(value),revokeRefreshTokens:async()=>{}};
 const service=createStaffService(database,auth);await assert.rejects(service.staff(data,{uid:'bad',email:'other@example.com',email_verified:true}),{code:'permission-denied'});assert.equal(calls.length,0);
 const result=await service.staff(data,{uid:'owner',email:'yfastvpn@gmail.com',email_verified:true});assert.equal(result.username,'bd_admin');assert.equal(calls[0].disabled,true);assert.equal(calls.at(-1).disabled,false);for(const fields of records.values())assert.equal(decodeFields(fields).password,undefined);assert.equal(decodeFields(records.get('admins/'+result.uid)).permissions.owner,undefined);
});
