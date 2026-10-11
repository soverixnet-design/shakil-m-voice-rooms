import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,runTransaction,serverTimestamp} from 'firebase/firestore';
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env=await initializeTestEnvironment({projectId:'demo-voice-admin',firestore:{host,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8')}});
const user=(uid,email=uid+'@example.com')=>env.authenticatedContext(uid,{email,email_verified:true}).firestore();
const owner=user('owner','yfastvpn@gmail.com'),seller=user('seller'),recipient=user('recipient'),other=user('other'),limited=user('limited'),moderator=user('moderator'),support=user('support');
async function seed(){await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();for(const [id,email] of [['owner','yfastvpn@gmail.com'],['seller','seller@example.com'],['recipient','recipient@example.com'],['other','other@example.com'],['limited','limited@example.com'],['moderator','moderator@example.com'],['support','support@example.com']])await setDoc(doc(db,'users',id),{id:id,coins:100,email,status:'active',role:'user'});for(const [id,permission] of [['seller','seller'],['limited','content'],['moderator','moderate'],['support','support']])await setDoc(doc(db,'admins',id),{active:true,permissions:{[permission]:true}});await setDoc(doc(db,'sellerWallets','seller'),{balance:500});await setDoc(doc(db,'system','config'),{welcomeCoins:50000,bn:{t:'test'}})})}
async function transfer(db,id,amount=100,receiver='recipient',extra={}){return runTransaction(db,async t=>{const wref=doc(db,'sellerWallets','seller'),uref=doc(db,'users',receiver),w=await t.get(wref),u=await t.get(uref);const before=w.data().balance,coins=u.data().coins;t.update(wref,{balance:before-amount,lastTransferId:id});t.update(uref,{coins:coins+amount,lastSellerTransfer:id});t.set(doc(db,'sellerTransfers',id),{type:'transfer',sellerId:'seller',receiverId:receiver,receiverPublicId:receiver,amount,sellerBefore:before,sellerAfter:before-amount,receiverBefore:coins,receiverAfter:coins+amount,createdAt:serverTimestamp(),...extra})})}
try{
 await seed();
 await assertFails(setDoc(doc(other,'admins','other'),{active:true,permissions:{seller:true}}));
 await assertSucceeds(setDoc(doc(owner,'admins','other'),{active:true,permissions:{}}));
 await assertFails(updateDoc(doc(seller,'sellerWallets','seller'),{balance:999999}));
 await assertFails(updateDoc(doc(seller,'users','recipient'),{coins:1000}));
 await assertFails(updateDoc(doc(seller,'users','seller'),{role:'admin'}));
 await assertSucceeds(transfer(seller,'valid-transfer'));let w=await getDoc(doc(seller,'sellerWallets','seller')),r=await getDoc(doc(recipient,'users','recipient'));if(w.data().balance!==400||r.data().coins!==200)throw Error('Balance conservation failed');
 await assertFails(transfer(seller,'valid-transfer'));await assertFails(transfer(seller,'overspend',401));await assertFails(transfer(seller,'negative',-10));await assertFails(transfer(seller,'mismatch',100,'recipient',{receiverAfter:9999}));await assertFails(transfer(seller,'self-send',10,'seller'));
 await assertSucceeds(updateDoc(doc(owner,'admins','seller'),{active:false}));await assertFails(transfer(seller,'revoked'));await assertSucceeds(updateDoc(doc(owner,'admins','seller'),{active:true}));
 await assertFails(updateDoc(doc(limited,'system','config'),{welcomeCoins:999999}));await assertSucceeds(updateDoc(doc(limited,'system','config'),{bn:{t:'Published'}}));
 await assertSucceeds(setDoc(doc(limited,'assets','frame'),{kind:'frame',name:'Frame',image:'data:image/webp;base64,YQ==',active:true}));await assertFails(setDoc(doc(other,'assets','bad'),{kind:'frame',name:'Frame',image:'data:image/webp;base64,YQ==',active:true}));
 await assertFails(updateDoc(doc(moderator,'users','recipient'),{coins:10000}));await assertFails(updateDoc(doc(moderator,'users','owner'),{status:'banned'}));await assertSucceeds(updateDoc(doc(moderator,'users','recipient'),{status:'banned'}));
 await assertFails(updateDoc(doc(recipient,'users','recipient'),{status:'active'}));await assertFails(updateDoc(doc(recipient,'users','recipient'),{name:'Blocked user'}));await assertFails(transfer(seller,'blocked'));await assertSucceeds(updateDoc(doc(moderator,'users','recipient'),{status:'active'}));
 await assertSucceeds(setDoc(doc(recipient,'supportTickets','recipient'),{userId:'recipient',name:'Recipient',lastMessage:'Help',status:'open',updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(recipient,'supportTickets','recipient','messages','question'),{senderId:'recipient',kind:'customer',text:'Help',image:'',createdAt:serverTimestamp()}));
 await assertFails(getDoc(doc(other,'supportTickets','recipient','messages','question')));await assertFails(setDoc(doc(recipient,'supportTickets','recipient','messages','fake-staff'),{senderId:'recipient',kind:'staff',text:'Official',image:'',createdAt:serverTimestamp()}));
 await assertSucceeds(getDoc(doc(support,'supportTickets','recipient','messages','question')));await assertSucceeds(setDoc(doc(support,'supportTickets','recipient','messages','reply'),{senderId:'support',kind:'staff',text:'Reply',image:'',createdAt:serverTimestamp()}));
 await assertFails(deleteDoc(doc(owner,'sellerTransfers','valid-transfer')));
 await seed();const races=await Promise.allSettled([transfer(seller,'race-one',300),transfer(seller,'race-two',300)]);if(races.filter(x=>x.status==='fulfilled').length!==1)throw Error('Concurrent overspend accepted');const remaining=await getDoc(doc(seller,'sellerWallets','seller'));if(remaining.data().balance!==200)throw Error('Incorrect concurrent balance');
 console.log('PASS: seller conservation, replay/overspend/revocation, scoped permissions, block enforcement, support privacy and immutable receipts');
}finally{await env.cleanup()}
