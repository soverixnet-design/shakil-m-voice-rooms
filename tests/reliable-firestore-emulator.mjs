import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,collection,serverTimestamp,setDoc as seed} from 'firebase/firestore';
import {createReliableFirestore} from '../src/lib/reliableFirestoreCore.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const project='demo-reliable-rooms',[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env=await initializeTestEnvironment({projectId:project,firestore:{host,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8')}});
const now=Math.floor(Date.now()/1000),payload={sub:'visitor',user_id:'visitor',aud:project,iss:`https://securetoken.google.com/${project}`,iat:now,exp:now+3600,email:'v@example.com',firebase:{sign_in_provider:'custom',identities:{}}},token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.';
const db=env.authenticatedContext('visitor',{email:'v@example.com'}).firestore();
const api=createReliableFirestore({db,root:`http://${host}:${port}/v1/projects/${project}/databases/(default)/documents`,nameRoot:`projects/${project}/databases/(default)/documents`,getToken:async()=>token});
try{
 await env.withSecurityRulesDisabled(async context=>{const admin=context.firestore();await seed(doc(admin,'users','visitor'),{id:'123',name:'Visitor',coins:1234,status:'active',online:true,currentRoomId:null,roomSeat:null});await seed(doc(admin,'users','host'),{id:'234',name:'Host',coins:1000,status:'active'});await seed(doc(admin,'rooms','open'),{hostId:'host',locked:false,name:'Open',sc:8});await seed(doc(admin,'rooms','locked'),{hostId:'host',locked:true,name:'Locked',sc:8});});
 assert.equal((await api.getDoc(doc(db,'rooms','open'))).data().name,'Open');
 await api.updateDoc(doc(db,'users','visitor'),{currentRoomId:'open',roomSeat:0,online:true,lastSeen:serverTimestamp()});
 const profile=(await api.getDoc(doc(db,'users','visitor'))).data();assert.equal(profile.currentRoomId,'open');assert.equal(profile.coins,1234);assert(profile.lastSeen.toMillis()>0);
 const members=await api.getDocs(api.query(collection(db,'users'),api.where('currentRoomId','==','open')));assert.equal(members.size,1);
 await assert.rejects(api.updateDoc(doc(db,'users','visitor'),{currentRoomId:'locked',roomSeat:null,lastSeen:serverTimestamp()}));
 await api.setDoc(doc(db,'rooms','open','voicePeers','visitor'),{session:'session',speaking:true,updatedAt:serverTimestamp()});
 assert.equal((await api.getDoc(doc(db,'rooms','open','voicePeers','visitor'))).data().speaking,true);
 await api.runTransaction(db,async t=>{const ref=doc(db,'users','visitor'),existing=await t.get(ref);assert.equal(existing.data().coins,1234);t.update(ref,{roomSeat:1,lastSeen:serverTimestamp()})});
 assert.equal((await api.getDoc(doc(db,'users','visitor'))).data().roomSeat,1);
 await Promise.all([0,1].map(()=>api.runTransaction(db,async t=>{const ref=doc(db,'users','visitor'),previous=await t.get(ref);t.update(ref,{roomSeat:previous.data().roomSeat+1,lastSeen:serverTimestamp()})})));
 assert.equal((await api.getDoc(doc(db,'users','visitor'))).data().roomSeat,3);
 await api.deleteDoc(doc(db,'rooms','open','voicePeers','visitor'));
 assert.equal((await api.getDoc(doc(db,'rooms','open','voicePeers','visitor'))).exists(),false);
 console.log('PASS: direct room entry, locked room denial, confirmed timestamps/balances, member queries, voice presence and atomic seat updates follow existing rules');
}finally{await env.cleanup()}
