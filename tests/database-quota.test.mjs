import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,doc} from 'firebase/firestore';
import {createReliableFirestore} from '../src/lib/reliableFirestoreCore.ts';
test('write quota errors stop repeated writes and preserve explicit failure',async t=>{
 const app=initializeApp({projectId:'demo-quota'},'quota-test'),db=getFirestore(app);let requests=0,notices=0;
 t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',message:'Daily write quota exceeded'}}),{status:429})});
 const api=createReliableFirestore({db,root:'https://example.test/documents',nameRoot:'projects/demo-quota/databases/(default)/documents',getToken:async()=> 'emulator-token',onQuota:()=>notices++});
 try{for(let i=0;i<3;i++)await assert.rejects(api.updateDoc(doc(db,'users','self'),{roomSeat:0}),{code:'resource-exhausted'});assert.equal(requests,1);assert.equal(notices,1)}finally{await deleteApp(app)}
});
test('simultaneous reads share transport but fresh reads, identities and writes stay separate',async t=>{
 const app=initializeApp({projectId:'demo-speed'},'speed-test'),db=getFirestore(app);let requests=0,token='one';
 t.mock.method(globalThis,'fetch',async()=>{requests++;await new Promise(r=>setImmediate(r));return new Response(JSON.stringify({fields:{name:{stringValue:'User'}}}),{status:200})});
 const api=createReliableFirestore({db,root:'https://example.test/documents',nameRoot:'projects/demo-speed/databases/(default)/documents',getToken:async()=>token}),ref=doc(db,'users','self');
 try{
  await Promise.all([api.getDoc(ref),api.getDoc(ref)]);assert.equal(requests,1);
  await api.getDoc(ref);assert.equal(requests,2);
  const first=api.getDoc(ref);token='two';await Promise.all([first,api.getDoc(ref)]);assert.equal(requests,4);
  await Promise.all([api.updateDoc(ref,{roomSeat:0}),api.updateDoc(ref,{roomSeat:1})]);assert.equal(requests,6);
 }finally{await deleteApp(app)}
});
