import {createHash} from 'node:crypto';
import agoraToken from 'agora-token';
const {RtcTokenBuilder}=agoraToken;
export function createAgoraVoiceConfig(store,{appId=process.env.AGORA_APP_ID,certificate=process.env.AGORA_APP_CERTIFICATE,clock=Date.now,build=RtcTokenBuilder.buildTokenWithUserAccount}={}){
 return async(data,uid)=>{
  if(typeof data.roomId!=='string'||!data.roomId||data.roomId.length>200||data.roomId.includes('/'))throw Object.assign(Error('invalid-request'),{code:'invalid-argument'});
  if(!/^[a-f0-9]{32}$/i.test(appId||'')||!/^[a-f0-9]{32}$/i.test(certificate||''))throw Object.assign(Error('agora-not-configured'),{code:'unavailable'});
  return store.runTransaction(async tx=>{
   const [userDoc,roomDoc,controlDoc]=await Promise.all([tx.get(store.doc(`users/${uid}`)),tx.get(store.doc(`rooms/${data.roomId}`)),tx.get(store.doc(`rooms/${data.roomId}/controls/${uid}`))]);
   const user=userDoc.data(),room=roomDoc.data(),control=controlDoc.data()||{};
   if(!user||!room||['banned','archived'].includes(user.status)||user.currentRoomId!==data.roomId||control.blocked)throw Object.assign(Error('permission-denied'),{code:'permission-denied'});
   const canPublish=Number.isInteger(user.roomSeat)&&user.roomSeat>=0&&user.roomSeat<(room.sc||(room.d?12:8))&&!control.muted;
   const channel='room_'+createHash('sha256').update(data.roomId).digest('hex').slice(0,48);
   const token=build(appId,certificate,channel,uid,canPublish?1:2,90,90);
   if(!token)throw Object.assign(Error('agora-not-configured'),{code:'unavailable'});
   return {provider:'agora',appId,channel,uid,token,canPublish,expiresAt:clock()+90000,renewAfterMs:20000};
  });
 };
}
