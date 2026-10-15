import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceService} from '../functions/device-service.js';
import {encodeFields} from '../functions/social-migration.js';
test('device bans block another account on the same installation and can be revoked only by moderators',async()=>{
 const docs=new Map(),put=(path,value)=>docs.set(path,{path,fields:encodeFields(value)});
 put('users/target',{id:'100001',email:'target@example.com'});put('users/staff',{id:'100002'});put('admins/staff',{active:true,permissions:{moderate:true}});
 const c={query:async(sql,args)=>{if(sql.startsWith('insert')){docs.set(args[0],{path:args[0],fields:JSON.parse(args[3])});return {rows:[]}}return {rows:sql.includes('where parent=')?[...docs.values()].filter(r=>r.path.slice(0,r.path.lastIndexOf('/'))===args[0]):docs.has(args[0])?[docs.get(args[0])]:[]}}};
 const service=createDeviceService({transaction:fn=>fn(c)}),device='install-12345678-1234-1234-1234-123456789abc',staff={uid:'staff'},target={uid:'target'};
 await service.checkDevice(target,device);
 await assert.rejects(service.devices({action:'ban',uid:'target'},{uid:'stranger'}),{code:'permission-denied'});
 assert.equal((await service.devices({action:'ban',uid:'target'},staff)).devices[0].banned,true);
 await assert.rejects(service.checkDevice({uid:'other-account'},device),{code:'device-banned'});
 await assert.rejects(service.checkDevice(target,''),{code:'device-required'});
 await service.devices({action:'unban',uid:'target'},staff);await service.checkDevice({uid:'other-account'},device);
 put('admins/staff',{active:false,permissions:{moderate:true}});await assert.rejects(service.devices({action:'ban',uid:'target'},staff),{code:'permission-denied'});
 put('users/target',{id:'100001',email:'yfastvpn@gmail.com'});await assert.rejects(service.devices({action:'ban',uid:'target'},{uid:'owner',email:'yfastvpn@gmail.com',email_verified:true}),{code:'permission-denied'});
});
