import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocialWalletStore} from '../functions/social-wallet-store.js';
import {createWalletService} from '../functions/wallet-service.js';
import {encodeFields,decodeFields} from '../functions/social-migration.js';
export function fixture(){
 const rows=new Map();const put=(path,data)=>rows.set(path,{path,fields:encodeFields(data)});
 const clock=()=>Date.parse('2026-10-13T01:00:00Z');
 put('users/sender',{name:'Sender',coins:1000,status:'active'});
 put('users/receiver',{id:'222',name:'Receiver',coins:50,status:'active',online:true,currentRoomId:'room',lastSeen:new Date(clock())});
 put('diamondWallets/receiver',{balance:200,lifetimeReceived:200});
 put('system/config',{customGifts:[{name:'Rose',icon:'🌹',price:10}]});
 const client={query:async(sql,args)=>{
  if(sql.startsWith('select')){const found=sql.includes('where parent=')?[...rows.values()].filter(r=>r.path.slice(0,r.path.lastIndexOf('/'))===args[0]):rows.has(args[0])?[rows.get(args[0])]:[];return {rows:found,rowCount:found.length};}
  if(sql.startsWith('insert')){put(args[0],decodeFields(JSON.parse(args[3])));return {rows:[],rowCount:1};}
  throw Error('Unexpected SQL');
 }};
 const database={pool:client,transaction:async work=>{const before=new Map(rows);try{return await work(client)}catch(e){rows.clear();for(const [k,v]of before)rows.set(k,v);throw e}}};
 const source={doc:()=>{throw Error('Unexpected Firebase read')},collection:()=>{throw Error('Unexpected Firebase query')}};
 return {service:createWalletService(createSocialWalletStore(database,source),clock),store:createSocialWalletStore(database,source),rows,put};
}
test('Supabase gifts debit and credit once while preserving room events and retry receipts',async()=>{
 const {service,rows}=fixture();const data={receiverId:'receiver',item:{name:'Rose',emoji:'🌹',cost:10},quantity:3,requestId:'gift-request-12345678'};
 const first=await service.gift(data,'sender'),second=await service.gift(data,'sender');
 assert.equal(first.balance,970);assert.equal(second.balance,970);
 assert.equal(decodeFields(rows.get('users/sender').fields).coins,970);
 assert.equal(decodeFields(rows.get('diamondWallets/receiver').fields).balance,230);
 assert(rows.has('rooms/room/giftEvents/'+first.id));
 await assert.rejects(service.gift({...data,quantity:4},'sender'),/request-conflict/);
});
test('diamond exchange preserves the 100-to-70 rate, checks funds and is idempotent',async()=>{
 const {service,rows}=fixture();const data={diamonds:100,requestId:'exchange-request-12345678'};
 assert.equal((await service.exchange(data,'receiver')).balance,120);
 assert.equal((await service.exchange(data,'receiver')).balance,120);
 assert.equal(decodeFields(rows.get('diamondWallets/receiver').fields).balance,100);
 await assert.rejects(service.exchange({diamonds:200,requestId:'exchange-request-22345678'},'receiver'),/insufficient-diamonds/);
 assert.equal(decodeFields(rows.get('users/receiver').fields).coins,120);
});
test('successful gifts publish one public banner with a profile photo and ID, without wallet data',async()=>{const {service,rows,put}=fixture();put('users/sender',{id:'111',name:'Sender',avatar:'🌟',coins:1000,status:'active'});put('users/receiver',{id:'222',name:'Receiver',photoURL:'https://example.com/photo.png',coins:50,status:'active'});const request={receiverId:'receiver',item:{name:'Rose',cost:10},quantity:2,requestId:'announcement-gift-12345'};const receipt=await service.gift(request,'sender');await service.gift(request,'sender');const list=[...rows.values()].filter(r=>r.path.startsWith('liveAnnouncements/'));assert.equal(list.length,1);const event=decodeFields(list[0].fields);assert.equal(event.publicId,'222');assert.equal(event.senderPublicId,'111');assert.equal(event.avatar,'https://example.com/photo.png');assert.equal(event.amount,20);assert.equal(event.type,'gift');assert.equal(event.balance,undefined);assert.equal(event.diamonds,undefined);assert.equal(receipt.balance,980);});

test('wallet transactions reuse document reads but keep multiple writes and balances consistent',async()=>{
 const data=new Map([['users/user',encodeFields({coins:10,status:'active'})]]),counts=new Map();
 const client={query:async(sql,args)=>{if(sql.startsWith('select')){counts.set(args[0],(counts.get(args[0])||0)+1);return {rows:data.has(args[0])?[{fields:data.get(args[0])}]:[]}};data.set(args[0],JSON.parse(args[3]));return {rows:[]}}};
 const store=createSocialWalletStore({pool:client,transaction:async fn=>fn(client)},{}),ref=store.doc('users/user');
 await store.runTransaction(async tx=>{const [a,b]=await Promise.all([tx.get(ref),tx.get(ref)]);assert.equal(a.data().coins,10);assert.equal(b.data().coins,10);tx.update(ref,{coins:9});tx.update(ref,{badge:'Active'})});
 assert.equal(counts.get('users/user'),1);assert.equal(decodeFields(data.get('users/user')).coins,9);assert.equal(decodeFields(data.get('users/user')).badge,'Active');
});

test('animated gifts use a registered asset ID without uploading the animation on every send',async()=>{
 const f=fixture(),image='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';f.put('assets/rose-animation',{kind:'gift',name:'Animated Rose',price:10,image,active:true});
 const request={receiverId:'receiver',item:{name:'Animated Rose',cost:10,assetId:'rose-animation'},quantity:1,requestId:'animated-request-12345678'};
 const first=await f.service.gift(request,'sender');assert.equal(first.giftImage,image);assert.equal(first.giftAssetId,'rose-animation');assert.equal(first.balance,990);assert.equal((await f.service.gift(request,'sender')).balance,990);
 await assert.rejects(f.service.gift({...request,item:{...request.item,cost:1},requestId:'animated-request-22345678'},'sender'),/invalid-gift/);
 f.put('assets/rose-animation',{kind:'gift',name:'Animated Rose',price:10,image,active:false});await assert.rejects(f.service.gift({...request,requestId:'animated-request-32345678'},'sender'),/invalid-gift/);
});

test('Supabase-backed Lucky Gifts settle each quantity and persist one idempotent receipt',async()=>{
 const f=fixture();
 f.put('system/luckyGiftConfig',{enabled:true,chancesBps:{'5':10000,'10':0,'50':0,'100':0},maxPayout:100000000});
 f.put('users/sender',{name:'Sender',coins:1000,status:'active',currentRoomId:'room'});
 const data={action:'send',roomId:'room',receiverId:'receiver',itemId:'kitty',quotedCost:20,quantity:2,requestId:'supabase-lucky-12345678'};
 const first=await f.service.luckyGift(data,'sender');
 const second=await f.service.luckyGift(data,'sender');
 assert.equal(first.balance,1160);
 assert.equal(first.luckyWins,2);
 assert.equal(first.luckyReward,200);
 assert.deepEqual(second,first);
 assert.equal(decodeFields(f.rows.get('users/sender').fields).coins,1160);
 assert.equal(decodeFields(f.rows.get('diamondWallets/receiver').fields).balance,240);
 assert.equal([...f.rows.keys()].filter(path=>path.startsWith('transactions/lucky_')).length,1);
 assert.equal([...f.rows.keys()].filter(path=>path.startsWith('rooms/room/giftEvents/lucky_')).length,1);
 assert.equal([...f.rows.keys()].filter(path=>path.startsWith('liveAnnouncements/lucky_')).length,1);
 await assert.rejects(f.service.luckyGift({...data,quantity:3},'sender'),/request-conflict/);
 assert.equal(decodeFields(f.rows.get('users/sender').fields).coins,1160);
});
