import test from 'node:test';
import assert from 'node:assert/strict';
import {createSellerDirectoryService} from '../functions/seller-directory.js';
import {encodeFields,decodeFields} from '../functions/social-migration.js';
function fixture(){
 const docs=new Map(),put=(path,value)=>docs.set(path,{path,fields:encodeFields(value)});
 put('users/buyer',{id:'111',status:'active'});
 put('users/dealer',{id:'222',name:'Dealer',email:'private@example.com',coins:9999,diamond:40,status:'active',avatar:'👤'});
 put('admins/dealer',{active:true,permissions:{seller:true,moderate:true},password:'never-publish',sellerBio:'Message for recharge'});
 put('sellerWallets/dealer',{balance:1320000});
 const database={transaction:fn=>fn({query:async(sql,args)=>{
  if(sql.includes('count(*)'))return {rows:[{seller_id:'dealer',transfers:2,sent:'3000'}]};
  if(sql.includes('path=ANY'))return {rows:args[0].flatMap(p=>docs.has(p)?[docs.get(p)]:[])};
  if(sql.includes('where parent='))return {rows:[...docs.values()].filter(r=>r.path.startsWith('admins/')&&decodeFields(r.fields).active&&decodeFields(r.fields).permissions?.seller)};
  return {rows:docs.has(args[0])?[docs.get(args[0])]:[]};
 }})};return {put,service:createSellerDirectoryService(database)};
}
test('seller cards derive from existing ID grants and expose only business fields',async()=>{const f=fixture(),result=await f.service.sellers({action:'list'},{uid:'buyer'});assert.equal(result.rows.length,1);assert.equal(result.rows[0].id,'222');assert.equal(result.rows[0].balance,1320000);assert.equal(result.rows[0].sent,3000);assert.equal(result.mine,null);for(const key of ['email','coins','diamond','permissions','password'])assert.equal(result.rows[0][key],undefined);assert.equal((await f.service.sellers({action:'list'},{uid:'dealer'})).mine.id,'222');});
test('revocation and banned sellers disappear without new accounts or passwords',async()=>{const f=fixture();f.put('admins/dealer',{active:true,permissions:{seller:false}});assert.equal((await f.service.sellers({action:'list'},{uid:'buyer'})).rows.length,0);f.put('admins/dealer',{active:true,permissions:{seller:true}});f.put('users/dealer',{id:'222',status:'banned'});assert.equal((await f.service.sellers({action:'list'},{uid:'buyer'})).rows.length,0);});
test('unauthenticated and blocked viewers cannot read seller balances',async()=>{const f=fixture();await assert.rejects(f.service.sellers({action:'list'},{}),{code:'permission-denied'});f.put('users/buyer',{id:'111',status:'banned'});await assert.rejects(f.service.sellers({action:'list'},{uid:'buyer'}),{code:'permission-denied'});});
test('directory endpoint does not accept grant or coin changes from clients',async()=>{const f=fixture();await assert.rejects(f.service.sellers({action:'grant',id:'111',coins:99999},{uid:'buyer'}),{code:'invalid-argument'});});
