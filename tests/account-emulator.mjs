import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createAccountService} from '../functions/account-service.js';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
const app=initializeApp({projectId:'demo-account-bootstrap'},'account-bootstrap-test'),db=getFirestore(app),service=createAccountService(db);
try{
  const identity={uid:'new-account',email:'new@example.com',name:'New User',email_verified:true};
  const responses=await Promise.all([service.account({uid:'victim',coins:999999,role:'admin'},identity),service.account({},identity)]);
  assert.equal(responses[0].id,responses[1].id);
  assert.equal((await db.doc('users/new-account').get()).data().coins,50000);
  assert.equal(responses[0].role,'user');
  assert.equal((await db.doc('users/victim').get()).exists,false);
  await db.doc('users/new-account').update({coins:12345,diamond:789,name:'Saved Name',photoURL:'https://example.com/photo.png',currentRoomId:'old-room',roomSeat:2});
  const saved=await service.account({},identity);
  assert.equal(saved.coins,12345);assert.equal(saved.name,'Saved Name');
  const profile=(await db.doc('users/new-account').get()).data();
  assert.equal(profile.diamond,789);assert.equal(profile.currentRoomId,null);assert.equal(profile.roomSeat,null);
  await db.doc('users/new-account').update({status:'banned'});
  await assert.rejects(service.account({},identity),/inactive-user/);
  assert.equal((await service.account({role:'admin'},{uid:'unverified-owner',email:'yfastvpn@gmail.com',email_verified:false})).role,'user');
  assert.equal((await service.account({},{uid:'verified-owner',email:'yfastvpn@gmail.com',email_verified:true})).role,'admin');
  console.log('PASS: server account bootstrap uses verified identity, creates once, preserves coins/diamonds/profile, blocks banned accounts and restricts owner access');
}finally{await deleteApp(app)}
