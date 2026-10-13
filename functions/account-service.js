import {randomInt} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
const OWNER='yfastvpn@gmail.com';
export function createAccountService(db){
  async function account(_data,identity){
    const uid=identity.uid,ref=db.doc(`users/${uid}`);
    const owner=identity.email_verified===true&&identity.email?.toLowerCase()===OWNER;
    const name=String(identity.name||identity.email?.split('@')[0]||'User').slice(0,80);
    const photoURL=typeof identity.picture==='string'&&identity.picture.startsWith('https://')?identity.picture:'';
    for(let attempt=0;attempt<10;attempt++){
      const candidate=String(randomInt(100000000,1000000000));
      const result=await db.runTransaction(async t=>{
        const previous=await t.get(ref),old=previous.data()||{};
        if(['banned','archived'].includes(old.status))throw Error('inactive-user');
        let id=old.id?String(old.id):candidate;
        if(!old.id){
          const reservation=db.doc(`userPublicIds/${candidate}`);
          const [reserved,existing]=await Promise.all([t.get(reservation),t.get(db.collection('users').where('id','==',candidate).limit(1))]);
          if(reserved.exists||!existing.empty)return null;
          t.set(reservation,{uid});
        }
        const presence={id,online:true,lastSeen:FieldValue.serverTimestamp()};
        if(previous.exists)t.update(ref,presence);
        else t.create(ref,{...presence,currentRoomId:null,roomSeat:null,userId:uid,name,email:identity.email||'',avatar:'👤',photoURL,coins:50000,role:owner?'admin':'user',status:'active',createdAt:FieldValue.serverTimestamp()});
        return {id,name:old.name||name,photoURL:old.photoURL||photoURL,coins:previous.exists?Number(old.coins||0):50000,role:owner?'admin':'user'};
      });
      if(result)return result;
    }
    throw Error('invalid-request');
  }
  return {account};
}
