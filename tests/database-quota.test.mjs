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
