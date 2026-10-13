import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './social-wallet.test.mjs';
import {createGameService} from '../functions/service.js';
import {GAMES,payout} from '../functions/engine.js';
import {decodeFields} from '../functions/social-migration.js';
test('all games use Supabase balances and settle copied-compatible rounds exactly once',async()=>{
 const {store,rows,put}=fixture();let now=320000;
 const service=createGameService(store,()=>now);
 const data=path=>decodeFields(rows.get(path)?.fields);
 for(const game of GAMES){
  put('users/sender',{name:'Sender',id:'111',coins:100000,status:'active',currentRoomId:'room'});
  const round=await service.sync(game,'sender');
  const request={game,roundId:round.id,index:0,amount:1000,taps:3,requestId:'request-'+game.replaceAll('_','-')+'-12345678'};
  await service.bet(request,'sender');await service.bet(request,'sender');
  assert.equal(data('users/sender').coins,97000);
  await assert.rejects(service.bet({...request,amount:10000},'sender'),/request-conflict/);
  now=round.closeAt;
  await assert.rejects(service.bet({...request,requestId:'late-request-12345678'},'sender'),/bet-closed/);
  await service.reveal(game,round.id);now=round.revealAt;
  await service.settleRound(game,round.id);
  const player=data(`sharedGames/${game}/rounds/${round.id}/players/sender`);
  const result=data(`sharedGames/${game}/rounds/${round.id}`).result;
  const expected=payout(game,player.bets,result);
  assert.equal(data('users/sender').coins,97000+expected);
  await service.settleRound(game,round.id);
  assert.equal(data('users/sender').coins,97000+expected);
  assert.equal(data(`gameReceipts/${game}_${round.id}_sender`).payout,expected);
  assert.equal(data(`gameRanks/daily_1970-01-01/players/sender`).uid,'sender');
  now=round.endAt;
 }
});
test('Supabase account adapter supports transactional query and create without Firebase fallback',async()=>{
 const {store}=fixture();
 await store.runTransaction(async t=>{const found=await t.get(store.collection('users').where('name','==','Sender').limit(1));assert.equal(found.size,1);t.create(store.doc('userPublicIds/123'),{uid:'sender'});});
 assert.equal((await store.doc('userPublicIds/123').get()).data().uid,'sender');
 await assert.rejects(store.runTransaction(t=>t.create(store.doc('userPublicIds/123'),{uid:'receiver'})),/already-exists/);
});
