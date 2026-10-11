import {collection,doc,runTransaction,serverTimestamp,type Firestore} from 'firebase/firestore';
export async function sendDirectGift(db:Firestore,{senderId,receiverId,roomId,item,quantity}:{senderId:string;receiverId:string;roomId?:string;item:{name:string;emoji:string;image?:string;cost:number};quantity:number}){
 const cost=item.cost*quantity;
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>999||!Number.isSafeInteger(item.cost)||item.cost<=0||!Number.isSafeInteger(cost))throw Error('সঠিক গিফট ও সংখ্যা দিন।');
 const ledger=doc(collection(db,'transactions'));
 return runTransaction(db,async t=>{
  const senderRef=doc(db,'users',senderId),receiverRef=doc(db,'users',receiverId);
  const source=await t.get(senderRef),destination=senderId===receiverId?source:await t.get(receiverRef);
  if(!source.exists()||!destination.exists()||['banned','archived'].includes(source.data().status)||['banned','archived'].includes(destination.data().status))throw Error('সক্রিয় ইউজার পাওয়া যায়নি।');
  const sender=source.data(),recipient=destination.data(),coins=Number(sender.coins||0);
  if(!Number.isSafeInteger(coins)||coins<cost)throw Error('কয়েন যথেষ্ট নয়।');
  const receiverOnline=recipient.online===true&&Date.now()-(recipient.lastSeen?.toMillis?.()||0)<90000;
  const destinationRoom=receiverOnline&&recipient.currentRoomId?String(recipient.currentRoomId):roomId||null;
  const event={type:'gift_sent',senderId,receiverId,userId:senderId,senderName:String(sender.name||'ইউজার').slice(0,80),receiverName:String(recipient.name||'ইউজার').slice(0,80),receiverPublicId:recipient.id||receiverId,receiverAvatar:String(recipient.avatar||'👤').slice(0,24),giftName:String(item.name||'গিফট').slice(0,80),emoji:String(item.emoji||'🎁').slice(0,24),giftImage:item.image||'',quantity,cost,roomId:destinationRoom,createdAt:serverTimestamp()};
  t.update(senderRef,{coins:coins-cost,giftSentCount:Number(sender.giftSentCount||0)+quantity,giftSentCoins:Number(sender.giftSentCoins||0)+cost});
  t.set(ledger,event);
  if(destinationRoom)t.set(doc(db,'rooms',destinationRoom,'giftEvents',ledger.id),event);
  return {...event,id:ledger.id,balance:coins-cost};
 });
}
