import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc} from 'firebase/firestore';
import {createGameService} from '../functions/service.js';
import {roundAt,payout,GAMES,outcome} from '../functions/engine.js';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
const app=initializeApp({projectId:'demo-voice-admin'},'shared-game-test'),db=getFirestore(app);
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env=await initializeTestEnvironment({projectId:'demo-voice-admin',firestore:{host,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8')}});
let clock=320000;const service=createGameService(db,()=>clock),uid='game-a',other='game-b';
const client=env.authenticatedContext(uid,{email:'a@example.com',email_verified:true}).firestore();
try{
 await env.clearFirestore();await db.doc(`users/${uid}`).set({id:'123456789',name:'A',coins:5000,status:'active',email:'a@example.com'});await db.doc(`users/${other}`).set({id:'987654321',name:'B',coins:5000,status:'active',email:'b@example.com'});
 const a=await service.sync('greedy_lion',uid);clock+=10000;const b=await service.sync('greedy_lion',other);assert.equal(a.id,b.id);assert.equal(a.closeAt,b.closeAt);
 const request={game:'greedy_lion',roundId:a.id,index:0,amount:1000,requestId:randomUUID()};await service.bet(request,uid);await service.bet({...request,index:1,requestId:randomUUID()},other);await service.bet(request,uid);assert.equal((await db.doc(`users/${uid}`).get()).data().coins,4000);assert.equal((await db.doc(`sharedGames/greedy_lion/rounds/${a.id}/players/${uid}`).get()).data().total,1000);
 await assertSucceeds(getDoc(doc(client,'sharedGames','greedy_lion','rounds',a.id,'players',other)));await assertFails(setDoc(doc(client,'sharedGames','greedy_lion','rounds',a.id,'players',uid),{total:999999}));await assertFails(getDoc(doc(client,'gameSecrets',`greedy_lion_${a.id}`)));await assertFails(updateDoc(doc(client,'users',uid),{coins:999999}));await assertFails(setDoc(doc(client,'sharedGames','greedy_lion','days','1970-01-01','ranking',uid),{won:999999}));
 await assert.rejects(service.bet({...request,amount:10000},uid),/request-conflict/);
 clock=a.closeAt;await assert.rejects(service.bet({...request,requestId:randomUUID()},uid),/bet-closed/);await service.bet(request,uid); // known committed retry after cutoff is safe
 await service.reveal('greedy_lion',a.id);const r=(await db.doc(`sharedGames/greedy_lion/rounds/${a.id}`).get()).data();assert(r.result);assert.equal((await db.doc(`sharedGames/greedy_lion/rounds/${a.id}/players/${uid}`).get()).data().settled,false);
 clock=a.revealAt;await Promise.all([service.settleRound('greedy_lion',a.id),service.settleRound('greedy_lion',a.id)]);const p=(await db.doc(`sharedGames/greedy_lion/rounds/${a.id}/players/${uid}`).get()).data(),expected=payout('greedy_lion',p.bets,r.result);assert.equal(p.payout,expected);assert.equal((await db.doc(`sharedGames/greedy_lion/weeks/1969-12-29/ranking/${uid}`).get()).data().won,expected);assert.equal((await db.doc(`gameRanks/daily_1970-01-01/players/${uid}`).get()).data().won,expected);assert.equal((await db.doc(`users/${uid}`).get()).data().coins,4000+expected);assert.equal((await db.doc(`sharedGames/greedy_lion/days/1970-01-01/ranking/${uid}`).get()).data().won,expected);await service.settleRound('greedy_lion',a.id);assert.equal((await db.doc(`users/${uid}`).get()).data().coins,4000+expected);
 clock=a.endAt;const next=await service.sync('slots',uid);await db.doc(`users/${uid}`).update({coins:1000});const race=await Promise.allSettled([service.bet({game:'slots',roundId:next.id,index:0,amount:1000,requestId:randomUUID()},uid),service.bet({game:'slots',roundId:next.id,index:0,amount:1000,requestId:randomUUID()},uid)]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal((await db.doc(`users/${uid}`).get()).data().coins,0);
 await db.doc(`users/${other}`).update({status:'banned'});await assert.rejects(service.bet({game:'slots',roundId:next.id,index:0,amount:1000,requestId:randomUUID()},other),/inactive-user/);await assert.rejects(service.sync('slots',other),/inactive-user/);
 await db.doc(`users/${other}`).update({status:'active',coins:1000000});for(const game of GAMES){await service.sync(game,other);await service.bet({game,roundId:roundAt(clock).id,index:0,amount:1000,requestId:randomUUID()},other);}clock=roundAt(clock).revealAt;await service.sweep();for(const game of GAMES)assert.equal((await db.doc(`sharedGames/${game}/rounds/${roundAt(clock).id}/players/${other}`).get()).data().settled,true);

 clock=roundAt(clock).endAt;await db.doc('users/'+uid).update({coins:10000});await db.doc('users/'+other).update({coins:10000});await db.doc('sharedGames/jackpot_fruit').set({pool:0});
 const jp=await service.sync('jackpot_fruit',uid);let seed=0;while(outcome('jackpot_fruit',String(seed)).bonus!=='JP')seed++;await db.doc(`gameSecrets/jackpot_fruit_${jp.id}`).update({seed:String(seed)});
 for(const player of [uid,other])await service.bet({game:'jackpot_fruit',roundId:jp.id,index:0,amount:1000,requestId:randomUUID()},player);
 assert.equal((await db.doc('sharedGames/jackpot_fruit').get()).data().pool,100);clock=jp.revealAt;await service.settleRound('jackpot_fruit',jp.id);const jpResult=(await db.doc(`sharedGames/jackpot_fruit/rounds/${jp.id}`).get()).data().result;assert.equal(jpResult.jackpotBudget,10);assert.equal(jpResult.totalStake,2000);assert.equal((await db.doc('sharedGames/jackpot_fruit').get()).data().pool,90);await service.settleRound('jackpot_fruit',jp.id);assert.equal((await db.doc('sharedGames/jackpot_fruit').get()).data().pool,90);
 clock=Math.ceil(clock/32000)*32000;await db.doc(`users/${uid}`).update({coins:100000});const fast=await service.sync('lion_wheel',uid);const rapid={game:'lion_wheel',roundId:fast.id,index:0,amount:1000,taps:25,requestId:randomUUID()};await service.bet(rapid,uid);await service.bet(rapid,uid);assert.equal((await db.doc(`users/${uid}`).get()).data().coins,75000);assert.equal((await db.doc(`sharedGames/lion_wheel/rounds/${fast.id}/players/${uid}`).get()).data().total,25000);await assert.rejects(service.bet({...rapid,taps:101,requestId:randomUUID()},uid),/invalid-request/);console.log('PASS: 25 rapid taps debit exactly once and invalid batch is rejected');
 console.log('PASS: two-user shared round/bets, denied client spoofing/private seed, cutoff, retry idempotency, concurrent overspend, settlement once, daily shared ranking, all five scheduled settlements');
}finally{await env.cleanup();await deleteApp(app)}
