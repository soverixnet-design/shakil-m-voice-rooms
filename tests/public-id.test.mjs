import test from 'node:test';
import assert from 'node:assert/strict';
import {migratePublicIds,allocatePublicId,retryPublicIdTransaction,PUBLIC_ID_COUNTER} from '../functions/public-id-service.js';
import {createSocialService} from '../functions/social-service.js';
import {encodeFields,decodeFields} from '../functions/social-migration.js';
function fixture(){
 const docs=new Map();const put=(path,data)=>docs.set(path,{path,fields:encodeFields(data)});
 const client={query:async(sql,args=[])=>{
  if(sql.startsWith('lock table'))return {rows:[]};
  if(sql.startsWith('select path,fields'))return {rows:sql.includes('where parent=')?[...docs.values()].filter(r=>r.path.slice(0,r.path.lastIndexOf('/'))===args[0]):docs.has(args[0])?[docs.get(args[0])]:[]};
  if(sql.startsWith('insert into')){const path=args[0],fields=JSON.parse(args[3]??args[2]);docs.set(path,{path,fields});return {rows:[],rowCount:1};}
  throw Error('Unexpected SQL '+sql);
 }};
 const database={transaction:async fn=>{const before=new Map(docs);try{return await fn(client)}catch(e){docs.clear();for(const [k,v] of before)docs.set(k,v);throw e;}}};
 return {docs,put,client,database};
}
test('migration orders existing accounts by signup, aligns room IDs and preserves balances and internal links',async()=>{
 const f=fixture();f.put('users/newer',{id:'399577060',createdAt:new Date('2026-10-02'),coins:700,currentRoomId:'room',roomSeat:2,referrerUid:'older'});f.put('users/older',{id:'800123456',createdAt:new Date('2026-10-01'),coins:100});f.put('rooms/room',{hostId:'newer',publicId:'399577060',sc:8});f.put('transactions/old',{senderId:'newer',amount:10,receiverPublicId:'800123456'});
 assert.deepEqual(await migratePublicIds(f.database),{users:2,rooms:1,next:100003});
 const user=decodeFields(f.docs.get('users/newer').fields);assert.equal(user.id,'100002');assert.equal(user.legacyPublicId,'399577060');assert.equal(user.coins,700);assert.equal(user.currentRoomId,'room');assert.equal(user.roomSeat,2);assert.equal(user.referrerUid,'older');assert.equal(decodeFields(f.docs.get('rooms/room').fields).publicId,user.id);assert.equal(decodeFields(f.docs.get('transactions/old').fields).receiverPublicId,'800123456');
 assert.deepEqual(await migratePublicIds(f.database),{alreadyMigrated:true});
 const service=createSocialService(f.database);const a=await service.account({},{uid:'third',name:'Third'}),b=await service.account({},{uid:'fourth',name:'Fourth'});assert.equal(a.id,'100003');assert.equal(b.id,'100004');assert.equal((await service.account({},{uid:'third'})).id,a.id);assert.equal(decodeFields(f.docs.get(PUBLIC_ID_COUNTER).fields).next,100005);
});
test('migration refuses unknown signup order and rolls back instead of partially renumbering',async()=>{
 const f=fixture();f.put('users/a',{id:'old',createdAt:new Date('2026-01-01')});f.put('users/b',{id:'old2'});await assert.rejects(migratePublicIds(f.database),/creation-time-missing/);assert.equal(decodeFields(f.docs.get('users/a').fields).id,'old');assert.equal(f.docs.has(PUBLIC_ID_COUNTER),false);
});
test('six digit capacity stops at 999999 without wrapping, failed allocation consumes no ID',async()=>{
 const f=fixture();f.put(PUBLIC_ID_COUNTER,{migrationVersion:1,next:999999});assert.equal(await f.database.transaction(allocatePublicId),'999999');await assert.rejects(f.database.transaction(allocatePublicId),{code:'resource-exhausted'});assert.equal(decodeFields(f.docs.get(PUBLIC_ID_COUNTER).fields).next,1000000);
 const g=fixture();await migratePublicIds(g.database);await assert.rejects(g.database.transaction(async client=>{await allocatePublicId(client);throw Error('aborted')}),/aborted/);assert.equal(await g.database.transaction(allocatePublicId),'100001');
});
test('concurrent serialization conflicts retry the whole transaction, other failures do not retry',async()=>{
 let calls=0;const db={transaction:async fn=>{calls++;if(calls<3)throw Object.assign(Error('concurrent allocation'),{code:'40001'});return fn({});}};assert.equal(await retryPublicIdTransaction(db,async()=> '100002'),'100002');assert.equal(calls,3);
 let failures=0;await assert.rejects(retryPublicIdTransaction({transaction:async()=>{failures++;throw Error('database offline')}},()=>{}),/offline/);assert.equal(failures,1);
});
