import {FieldValue} from 'firebase-admin/firestore';

// The authoritative Supabase receipt is committed first. Firestore is only a
// best-effort visual feed for legacy room listeners; never replay a debit here.
export function withLuckyRoomMirror(luckyGift,firestore,report=()=>{}){
 return async (...args)=>{
  const result=await luckyGift(...args);
  if(result?.type!=='lucky_gift_sent')return result;
  const roomId=String(result.roomId||''),eventId=String(result.id||'');
  if(!roomId||roomId.includes('/')||!eventId||eventId.includes('/'))return result;
  let timer;
  try{
   const write=firestore.doc(`rooms/${roomId}/giftEvents/${eventId}`).set({
    ...result,createdAt:FieldValue.serverTimestamp()
   });
   await Promise.race([write,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('visual-mirror-timeout')),2500);
   })]);
  }catch(error){report('lucky-gift-visual-mirror-failed',error?.code||error?.message||'unavailable');}
  finally{clearTimeout(timer);}
  return result;
 };
}
