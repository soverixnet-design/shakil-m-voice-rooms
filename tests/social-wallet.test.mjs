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
