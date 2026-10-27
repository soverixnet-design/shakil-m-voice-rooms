import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_LUCKY_GIFTS,validateLuckySettings,luckyOutcome} from '../functions/lucky-gift-engine.js';
import {createWalletService} from '../functions/wallet-service.js';

const enabled={enabled:true,chancesBps:{'5':10000,'10':0,'50':0,'100':0},maxPayout:100000000};
const normal={enabled:true,chancesBps:{'5':500,'10':200,'50':50,'100':10},maxPayout:100000000};
function memoryDb(initial={}){
 const docs=new Map(Object.entries(initial));
 const snap=(ref)=>({id:ref.id,ref,exists:docs.has(ref.path),data:()=>docs.get(ref.path)});
 const doc=path=>({path,id:path.split('/').at(-1),get:async()=>snap(doc(path))});
 const db={doc,collection:path=>({where:()=>({get:async()=>({docs:[]})})}),
  runTransaction:async callback=>{
   const changes=[];
   const tx={get:async ref=>snap(ref),set:(ref,value,options)=>changes.push(['set',ref.path,value,options]),
    update:(ref,value)=>changes.push(['update',ref.path,value])};
   const result=await callback(tx);
   for(const [mode,path,value,options] of changes){
    const prior=docs.get(path)||{};
    docs.set(path,mode==='update'||options?.merge?{...prior,...value}:value);
   }
   return result;
  }};
 return {db,docs};
}
const seed=()=>({
 'system/luckyGiftConfig':enabled,
 'users/sender':{name:'Sender',id:'100001',status:'active',currentRoomId:'room1',coins:500,giftSentCount:0,giftSentCoins:0},
 'users/receiver':{name:'Receiver',id:'100002',status:'active',currentRoomId:'room1',coins:10,giftReceivedCount:0,giftReceivedCoins:0}
});
const request={action:'send',roomId:'room1',receiverId:'receiver',itemId:'kitty',quotedCost:20,quantity:2,requestId:'abcdefghijklmnop'};

test('Lucky Gift catalog has positive server prices and recognized multipliers',()=>{
 assert.deepEqual(DEFAULT_LUCKY_GIFTS.map(g=>g.cost).slice(0,4),[20,40,60,60]);
 const config=validateLuckySettings(normal);
 assert.equal(config.expectedReturnBps,8000);
 assert.deepEqual([0,500,700,750,760,9999].map(roll=>luckyOutcome(100,config,()=>roll).multiplier),[5,10,50,100,0,0]);
});

test('invalid or disabled odds fail closed without a random payout',()=>{
 assert.throws(()=>validateLuckySettings({...normal,enabled:false}),/lucky-gifts-disabled/);
 assert.throws(()=>validateLuckySettings({...normal,chancesBps:{'5':10000,'10':1,'50':0,'100':0}}),/lucky-config-invalid/);
 assert.throws(()=>validateLuckySettings({...normal,maxPayout:0}),/lucky-config-invalid/);
 assert.throws(()=>luckyOutcome(100000000,validateLuckySettings({...enabled,maxPayout:100}),()=>0),/lucky-payout-limit/);
 assert.throws(()=>luckyOutcome(10,validateLuckySettings(normal),()=>10000),/lucky-random-invalid/);
});

test('one Lucky Gift send transfers real coins and recipient diamonds atomically',async()=>{
 const {db,docs}=memoryDb(seed()),service=createWalletService(db,()=>1234567890);
 const result=await service.luckyGift(request,'sender');
 assert.equal(result.cost,40);
 assert.equal(result.luckyMultiplier,5);
 assert.equal(result.luckyReward,200);
 assert.equal(result.balance,660);
 assert.equal(docs.get('users/sender').coins,660);
 assert.equal(docs.get('users/receiver').giftReceivedCoins,40);
 assert.equal(docs.get('diamondWallets/receiver').balance,40);
 assert.equal(docs.get('transactions/lucky_sender_abcdefghijklmnop').cost,40);
 assert.equal(docs.get('rooms/room1/giftEvents/lucky_sender_abcdefghijklmnop').type,'lucky_gift_sent');
 assert.equal(docs.get('liveAnnouncements/lucky_sender_abcdefghijklmnop').amount,200);
 const replay=await service.luckyGift(request,'sender');
 assert.deepEqual(replay,result);
 assert.equal(docs.get('users/sender').coins,660);
 await assert.rejects(service.luckyGift({...request,quantity:3},'sender'),/request-conflict/);
 await assert.rejects(service.luckyGift({...request,quotedCost:21},'sender'),/request-conflict/);
});

test('self gifts update both sender coins and own diamonds only once',async()=>{
 const docs=seed();docs['users/sender'].currentRoomId='room1';
 const {db,docs:state}=memoryDb(docs),service=createWalletService(db);
 const result=await service.luckyGift({...request,receiverId:'sender',quantity:1},'sender');
 assert.equal(result.balance,580);
 assert.equal(state.get('diamondWallets/sender').balance,20);
 assert.equal(state.get('users/sender').giftReceivedCoins,20);
});

test('disabled, missing recipient, stale room and insufficient balance do not debit wallet',async()=>{
 for(const scenario of ['disabled','missing','room','balance']){
  const docs=seed();if(scenario==='disabled')docs['system/luckyGiftConfig']={enabled:false};
  if(scenario==='missing')delete docs['users/receiver'];
  if(scenario==='room')docs['users/receiver'].currentRoomId='other';
  if(scenario==='balance')docs['users/sender'].coins=1;
  const {db,docs:state}=memoryDb(docs),service=createWalletService(db);
  await assert.rejects(service.luckyGift(request,'sender'));
  assert.equal(state.get('users/sender').coins,docs['users/sender'].coins);
  assert.equal(state.has('walletRequests/sender_abcdefghijklmnop'),false);
 }
});

test('catalog is read-only and empty configurations disable sending',async()=>{
 const {db,docs}=memoryDb(seed()),service=createWalletService(db);
 const catalog=await service.luckyGift({action:'catalog'},'sender');
 assert.equal(catalog.enabled,true);assert.equal(catalog.items.length,8);
 assert.deepEqual(catalog.multipliers,[5,10,50,100]);
 assert.equal(docs.has('walletRequests/sender_abcdefghijklmnop'),false);
});
