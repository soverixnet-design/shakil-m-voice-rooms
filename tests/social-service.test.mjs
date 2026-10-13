import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocialService} from '../functions/social-service.js';
import {encodeFields,decodeFields} from '../functions/social-migration.js';
const root='projects/gen-lang-client-0043151803/databases/ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b/documents';
const now=Date.parse('2026-10-13T01:00:00Z');
function fixture(){
 const docs=new Map();
 const put=(path,data)=>docs.set(path,{path,fields:encodeFields(data),updated_at:new Date(now),version:1});
 put('users/alice',{id:'111',name:'Alice',coins:12345,status:'active',currentRoomId:'room',roomSeat:1});
 put('users/bob',{id:'222',name:'Bob',coins:456,status:'active',currentRoomId:'room',roomSeat:2});
 put('users/host',{id:'333',name:'Host',coins:789,status:'active',currentRoomId:'room'});
 put('users/banned',{id:'444',name:'Banned',status:'banned'});
 put('rooms/room',{hostId:'host',name:'Original',sc:8,locked:false});
 put('rooms/room/voiceSignals/one',{from:'bob',to:'alice',payload:'private'});
 put('rooms/room/voiceSignals/two',{from:'alice',to:'bob',payload:'other private'});
 put('users/bob/roomLibrary/room',{followed:true});
 const client={query:async(sql,args=[])=>{
  if(sql.startsWith('select path,fields')){
   const rows=sql.includes('where parent=')?[...docs.values()].filter(r=>r.path.slice(0,r.path.lastIndexOf('/'))===args[0]):docs.has(args[0])?[docs.get(args[0])]:[];
   return {rows,rowCount:rows.length};
  }
  if(sql.startsWith('insert into earnbd.social_documents')){const path=args[0],fields=JSON.parse(args[3]??args[2]);docs.set(path,{path,fields,updated_at:new Date(args[4]||now),version:(docs.get(path)?.version||0)+1});return {rows:[],rowCount:1};}
  if(sql.startsWith('delete from')){docs.delete(args[0]);return {rows:[],rowCount:1};}
  throw Error('Unexpected SQL in test: '+sql);
 }};
 const db={transaction:async fn=>{const original=new Map(docs);try{return await fn(client)}catch(e){docs.clear();for(const [k,v]of original)docs.set(k,v);throw e}}};
 return {docs,put,service:createSocialService(db,()=>now)};
}
const identity=uid=>({uid,email:uid+'@example.com',email_verified:true});
const update=(path,data,condition)=>({update:{name:root+'/'+path,fields:encodeFields(data)},updateMask:{fieldPaths:Object.keys(data)},...(condition?{currentDocument:condition}:{})});
test('social reads require verified identity and protect private room history',async()=>{
 const {service}=fixture();
 await assert.rejects(service.social({action:'get',path:'users/alice'},{}),{code:'unauthenticated'});
 await assert.rejects(service.social({action:'get',path:'users/bob/roomLibrary/room'},identity('alice')),{code:'permission-denied'});
 await assert.rejects(service.social({action:'get',path:'users/alice'},identity('banned')),{code:'permission-denied'});
 assert.equal(decodeFields((await service.social({action:'get',path:'users/alice'},identity('alice'))).fields).coins,12345);
});
test('profile updates preserve existing balance and reject forged privilege or another user',async()=>{
 const {service,docs}=fixture();
 await service.social({action:'commit',writes:[update('users/alice',{name:'New name'})]},identity('alice'));
 assert.equal(decodeFields(docs.get('users/alice').fields).coins,12345);
 for(const data of [{coins:999999},{role:'admin'},{email:'yfastvpn@gmail.com'},{status:'active',id:'333'}])await assert.rejects(service.social({action:'commit',writes:[update('users/alice',data)]},identity('alice')),{code:'permission-denied'});
 await assert.rejects(service.social({action:'commit',writes:[update('users/bob',{name:'Hacked'})]},identity('alice')),{code:'permission-denied'});
});
test('locked rooms, blocked membership and locked seats are enforced on the server',async()=>{
 const {service,put}=fixture();
 put('rooms/room',{hostId:'host',locked:true,sc:8});put('users/alice',{id:'111',name:'Alice',status:'active',currentRoomId:null});
 await assert.rejects(service.social({action:'commit',writes:[update('users/alice',{currentRoomId:'room',roomSeat:null})]},identity('alice')),{code:'permission-denied'});
 put('rooms/room',{hostId:'host',locked:false,sc:8});put('rooms/room/controls/alice',{blocked:true,muted:false});
 await assert.rejects(service.social({action:'commit',writes:[update('users/alice',{currentRoomId:'room',roomSeat:1})]},identity('alice')),{code:'permission-denied'});
 put('rooms/room/controls/alice',{blocked:false,muted:false});put('rooms/room/seatPolicy/config',{locked:[1]});
 await assert.rejects(service.social({action:'commit',writes:[update('users/alice',{currentRoomId:'room',roomSeat:1})]},identity('alice')),{code:'permission-denied'});
 await service.social({action:'commit',writes:[update('users/alice',{currentRoomId:'room',roomSeat:2})]},identity('alice'));
});
test('room role changes require the existing owner',async()=>{
 const {service}=fixture();const writes=[{update:{name:root+'/rooms/room/roles/bob',fields:encodeFields({role:'admin',canLockSeats:false})}}];
 await assert.rejects(service.social({action:'commit',writes},identity('alice')),{code:'permission-denied'});
 await service.social({action:'commit',writes},identity('host'));
});
test('only the verified existing platform owner can create an official room with a custom ID',async()=>{
 const {service}=fixture();const writes=[{update:{name:root+'/rooms/official-room',fields:encodeFields({hostId:'host',name:'Official'})}}];
 await assert.rejects(service.social({action:'commit',writes},identity('alice')),{code:'permission-denied'});
 await service.social({action:'commit',writes},{uid:'host',email:'yfastvpn@gmail.com',email_verified:true});
});
test('voice signals can only be queried for the authenticated recipient',async()=>{
 const {service}=fixture();const structuredQuery={from:[{collectionId:'voiceSignals'}],where:{fieldFilter:{field:{fieldPath:'to'},op:'EQUAL',value:{stringValue:'alice'}}}};
 const result=await service.social({action:'query',parent:'rooms/room',structuredQuery},identity('alice'));
 assert.equal(result.length,1);assert.equal(result[0].document.name,root+'/rooms/room/voiceSignals/one');
 await assert.rejects(service.social({action:'get',path:'rooms/room/voiceSignals/two'},identity('alice')),{code:'permission-denied'});
 await assert.rejects(service.social({action:'query',parent:'rooms/room',structuredQuery:{from:[{collectionId:'voiceSignals'}]}},identity('alice')),{code:'permission-denied'});
});
test('stale conditional writes fail before mutating the document',async()=>{
 const {service,docs}=fixture();
 await assert.rejects(service.social({action:'commit',writes:[update('users/alice',{name:'Wrong'},{updateTime:'2020-01-01T00:00:00Z'})]},identity('alice')),{code:'failed-precondition'});
 assert.equal(decodeFields(docs.get('users/alice').fields).name,'Alice');
});
test('a concurrent update in the same millisecond invalidates the previous read token',async()=>{
 const {service,docs}=fixture();
 const old=await service.social({action:'get',path:'users/alice'},identity('alice'));
 await service.social({action:'commit',writes:[update('users/alice',{name:'First'},{updateTime:old.updateTime})]},identity('alice'));
 await assert.rejects(service.social({action:'commit',writes:[update('users/alice',{name:'Stale'},{updateTime:old.updateTime})]},identity('alice')),{code:'failed-precondition'});
 assert.equal(decodeFields(docs.get('users/alice').fields).name,'First');
});
test('migration codec preserves nested data and Firestore timestamps',()=>{
 const original={coins:12345,roomSeat:null,items:[{name:'Room'}],lastSeen:new Date(now)};
 const result=decodeFields(encodeFields(original));assert.deepEqual(result,{...original,lastSeen:new Date(now).toISOString()});
});

test('game reads allow public rounds but protect seeds, private receipts and all game writes',async()=>{
 const {service,put}=fixture();
 put('sharedGames/slots/rounds/10',{state:'open'});
 put('sharedGames/slots/rounds/10/players/alice',{bets:[1000]});
 put('sharedGames/slots/weeks/2026-10-12/ranking/alice',{won:1000});
 put('gameReceipts/alice-result',{uid:'alice',payout:100});
 put('gameReceipts/bob-result',{uid:'bob',payout:200});
 assert((await service.social({action:'get',path:'sharedGames/slots/rounds/10'},identity('alice'))).fields);
 assert((await service.social({action:'get',path:'sharedGames/slots/rounds/10/players/alice'},identity('alice'))).fields);
 await assert.rejects(service.social({action:'get',path:'gameSecrets/slots_10'},identity('alice')));
 await assert.rejects(service.social({action:'get',path:'gameReceipts/bob-result'},identity('alice')),/permission-denied/);
 await assert.rejects(service.social({action:'commit',writes:[update('sharedGames/slots/rounds/10',{result:{win:1}})]},identity('alice')),/permission-denied/);
 const found=await service.social({action:'query',structuredQuery:{from:[{collectionId:'gameReceipts'}],where:{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:'alice'}}}}},identity('alice'));
 assert.equal(found.length,1);
 await assert.rejects(service.social({action:'get',path:'sharedGames/slots/rounds/10'},identity('banned')),/permission-denied/);
});
