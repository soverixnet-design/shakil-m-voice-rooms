import {createHmac,randomInt} from 'node:crypto';
import {DEFAULT_LUCKY_GIFTS,LUCKY_MULTIPLIERS,validateLuckySettings,luckyOutcome} from './lucky-gift-engine.js';
import {FieldValue} from 'firebase-admin/firestore';
const DEFAULT_GIFTS=[['❤️','হার্ট',1],['🌹','গোলাপ',10],['⭐','স্টার',250],['💍','লাভ রিং',750],['💎','ডায়মন্ড',1100],['🚗','VIP কার',2000],['🚀','রকেট',5000],['👑','ক্রাউন',15000]];
export function createWalletService(db,clock=Date.now){
 const active=u=>u&&!['banned','archived'].includes(u.status),validId=id=>typeof id==='string'&&/^[A-Za-z0-9-]{16,80}$/.test(id);
 async function gift(data,uid){const {receiverId,item,quantity,requestId}=data;if(typeof receiverId!=='string'||!receiverId||receiverId.includes('/')||!item||!Number.isSafeInteger(quantity)||quantity<1||quantity>999||!validId(requestId))throw Error('invalid-request');const saved=await db.doc(`walletRequests/${uid}_${requestId}`).get();if(saved.exists){const x=saved.data();if(x.type!=='gift_sent'||x.receiverId!==receiverId||x.cost!==Number(item.cost)*quantity||x.quantity!==quantity||x.giftName!==item.name||(item.assetId?(x.giftAssetId||'')!==item.assetId:(x.giftImage||'')!==(item.image||'')))throw Error('request-conflict');return x;}let catalog;
 if(item.assetId){if(typeof item.assetId!=='string'||item.assetId.includes('/')||item.assetId.length>80)throw Error('invalid-gift');const asset=await db.doc('assets/'+item.assetId).get(),a=asset.data();catalog=asset.exists&&a.kind==='gift'&&a.active!==false?[{name:a.name,emoji:'🎁',cost:a.price,image:a.image,assetId:item.assetId}]:[]}
 else{const [config,assets]=await Promise.all([db.doc('system/config').get(),db.collection('assets').where('kind','==','gift').get()]);const custom=config.data()?.customGifts;catalog=(Array.isArray(custom)?custom.map(g=>({name:g.name,emoji:g.icon,cost:g.price})):DEFAULT_GIFTS.map(([emoji,name,cost])=>({emoji,name,cost}))).concat(assets.docs.filter(d=>d.data().active!==false).map(d=>({name:d.data().name,emoji:'🎁',cost:d.data().price,image:d.data().image,assetId:d.id})));}
 const selected=catalog.find(g=>g.name===item.name&&g.cost===item.cost&&(item.assetId?g.assetId===item.assetId:(g.image||'')===(item.image||'')));const cost=Number(selected?.cost)*quantity;if(!selected||!Number.isSafeInteger(cost)||cost<=0)throw Error('invalid-gift');const receipt=db.doc(`walletRequests/${uid}_${requestId}`),ledger=db.doc(`transactions/servergift_${uid}_${requestId}`),senderRef=db.doc(`users/${uid}`),receiverRef=db.doc(`users/${receiverId}`),diamondRef=db.doc(`diamondWallets/${receiverId}`);
 return db.runTransaction(async t=>{const [old,src,dst,vault]=await Promise.all([t.get(receipt),t.get(senderRef),t.get(receiverRef),t.get(diamondRef)]);if(old.exists){const x=old.data();if(x.receiverId!==receiverId||x.cost!==cost||x.quantity!==quantity||x.giftName!==selected.name)throw Error('request-conflict');return x;}const sender=src.data(),recipient=dst.data();if(!active(sender)||!active(recipient))throw Error('inactive-user');const coins=Number(sender.coins||0),diamonds=Number(vault.data()?.balance||0);if(!Number.isSafeInteger(coins)||coins<cost)throw Error('insufficient-coins');if(!Number.isSafeInteger(diamonds+cost))throw Error('invalid-balance');const online=recipient.online===true&&clock()-(recipient.lastSeen?.toMillis?.()||0)<90000,roomId=online&&recipient.currentRoomId?String(recipient.currentRoomId):null;const event={type:'gift_sent',senderId:uid,userId:uid,receiverId,senderName:String(sender.name||'User').slice(0,80),receiverName:String(recipient.name||'User').slice(0,80),receiverPublicId:recipient.id||receiverId,receiverAvatar:String(recipient.photoURL||recipient.avatar||'👤'),giftName:selected.name,emoji:selected.emoji||'🎁',giftImage:selected.image||'',giftAssetId:selected.assetId||'',quantity,cost,roomId,createdAt:FieldValue.serverTimestamp()};const debit={coins:coins-cost,giftSentCount:Number(sender.giftSentCount||0)+quantity,giftSentCoins:Number(sender.giftSentCoins||0)+cost};if(uid===receiverId)t.update(senderRef,{...debit,diamond:diamonds+cost,giftReceivedCount:Number(recipient.giftReceivedCount||0)+quantity,giftReceivedCoins:Number(recipient.giftReceivedCoins||0)+cost});else{t.update(senderRef,debit);t.update(receiverRef,{diamond:diamonds+cost,giftReceivedCount:Number(recipient.giftReceivedCount||0)+quantity,giftReceivedCoins:Number(recipient.giftReceivedCoins||0)+cost})}t.set(diamondRef,{balance:diamonds+cost,lifetimeReceived:Number(vault.data()?.lifetimeReceived||0)+cost},{merge:true});t.set(ledger,event);t.set(db.doc('liveAnnouncements/gift_'+ledger.id),{type:'gift',uid:receiverId,name:event.receiverName,publicId:event.receiverPublicId,avatar:event.receiverAvatar,senderName:event.senderName,senderPublicId:sender.id||uid,senderAvatar:String(sender.photoURL||sender.avatar||'👤'),amount:cost,quantity,giftName:selected.name,emoji:event.emoji,giftImage:event.giftImage,roomId,createdAt:clock()});if(roomId)t.set(db.doc(`rooms/${roomId}/giftEvents/${ledger.id}`),event);const result={...event,id:ledger.id,balance:coins-cost,diamonds:diamonds+cost,requestId,createdAt:clock()};t.set(receipt,result);return result;});}

 // One authenticated request, one atomic debit/credit, one durable receipt.
 // This is deliberately disabled until an owner publishes valid odds and caps.
 async function luckyGift(data,uid){
  if(data?.action==='catalog'){
   const settings=(await db.doc('system/luckyGiftConfig').get()).data()||{};
   return {enabled:settings.enabled===true,items:DEFAULT_LUCKY_GIFTS,
    multipliers:LUCKY_MULTIPLIERS,chancesBps:settings.enabled===true?settings.chancesBps:null};
  }
  if(!data||data.action!=='send'||!validId(data.requestId)||
    typeof data.receiverId!=='string'||!data.receiverId||data.receiverId.includes('/')||
    typeof data.roomId!=='string'||!data.roomId||data.roomId.includes('/')||
    typeof data.itemId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(data.itemId)||
    !Number.isSafeInteger(data.quantity)||data.quantity<1||data.quantity>777)throw Error('invalid-request');
  const {receiverId,roomId,itemId,quantity,requestId}=data;
  const receipt=db.doc(`walletRequests/${uid}_${requestId}`);
  const senderRef=db.doc(`users/${uid}`),receiverRef=db.doc(`users/${receiverId}`),vaultRef=db.doc(`diamondWallets/${receiverId}`);
  const settingsRef=db.doc('system/luckyGiftConfig');
  const builtin=DEFAULT_LUCKY_GIFTS.find(g=>g.id===itemId);
  const customRef=builtin?null:db.doc('assets/'+itemId);
  const randomRoll=randomInt(10000); // Fixed across transaction retries.
  return db.runTransaction(async t=>{
   const [previous,source,destination,vault,config,custom]=await Promise.all([
    t.get(receipt),t.get(senderRef),uid===receiverId?t.get(senderRef):t.get(receiverRef),
    t.get(vaultRef),t.get(settingsRef),customRef?t.get(customRef):Promise.resolve(null)
   ]);
   if(previous.exists){
    const old=previous.data();
    if(old.type!=='lucky_gift_sent'||old.receiverId!==receiverId||old.roomId!==roomId||
      old.itemId!==itemId||old.quantity!==quantity)throw Error('request-conflict');
    return old;
   }
   const policy=validateLuckySettings(config.data());
   const asset=custom?.data();
   const selected=builtin||(custom?.exists&&asset?.kind==='lucky-gift'&&asset.active===true?
    {id:itemId,name:asset.name,emoji:asset.icon||'🎁',image:asset.image||'',cost:asset.price}:null);
   if(!selected||!Number.isSafeInteger(Number(selected.cost))||Number(selected.cost)<1||
      Number(selected.cost)>1000000)throw Error('invalid-gift');
   const sender=source.data(),recipient=destination.data();
   if(!active(sender)||!active(recipient)||sender.currentRoomId!==roomId||
      recipient.currentRoomId!==roomId)throw Error('inactive-user');
   const cost=Number(selected.cost)*quantity;
   if(!Number.isSafeInteger(cost)||cost>100000000)throw Error('invalid-gift');
   const before=Number(sender.coins||0),diamonds=Number(vault.data()?.balance||0);
   if(!Number.isSafeInteger(before)||before<cost)throw Error('insufficient-coins');
   const outcome=luckyOutcome(cost,policy,()=>randomRoll);
   const balance=before-cost+outcome.reward;
   if(!Number.isSafeInteger(balance)||balance<0||!Number.isSafeInteger(diamonds+cost))
    throw Error('invalid-balance');
   const ledger=db.doc(`transactions/lucky_${uid}_${requestId}`);
   const event={type:'lucky_gift_sent',senderId:uid,userId:uid,receiverId,roomId,itemId,
    senderName:String(sender.name||'User').slice(0,80),receiverName:String(recipient.name||'User').slice(0,80),
    receiverPublicId:recipient.id||receiverId,receiverAvatar:String(recipient.photoURL||recipient.avatar||'👤'),
    giftName:String(selected.name||'Lucky Gift').slice(0,80),emoji:String(selected.emoji||'🎁').slice(0,24),
    giftImage:String(selected.image||''),quantity,cost,luckyMultiplier:outcome.multiplier,
    luckyReward:outcome.reward,createdAt:FieldValue.serverTimestamp()};
   const debit={coins:balance,giftSentCount:Number(sender.giftSentCount||0)+quantity,
    giftSentCoins:Number(sender.giftSentCoins||0)+cost};
   const credit={diamond:diamonds+cost,
    giftReceivedCount:Number(recipient.giftReceivedCount||0)+quantity,
    giftReceivedCoins:Number(recipient.giftReceivedCoins||0)+cost};
   if(uid===receiverId)t.update(senderRef,{...debit,...credit});
   else{t.update(senderRef,debit);t.update(receiverRef,credit)}
   t.set(vaultRef,{balance:diamonds+cost,lifetimeReceived:Number(vault.data()?.lifetimeReceived||0)+cost},{merge:true});
   t.set(ledger,event);
   t.set(db.doc(`rooms/${roomId}/giftEvents/${ledger.id}`),event);
   if(outcome.reward>0)t.set(db.doc(`liveAnnouncements/lucky_${uid}_${requestId}`),
    {type:'win',uid,name:String(sender.name||'User').slice(0,80),
     publicId:sender.id||uid,avatar:String(sender.photoURL||sender.avatar||'👤'),
     amount:outcome.reward,game:'lucky_gift',roomId,createdAt:clock()});
   const result={...event,id:ledger.id,balance,diamonds:diamonds+cost,
    type:'lucky_gift_sent',requestId,createdAt:clock()};
   t.set(receipt,result);
   return result;
  });
 }

 async function exchange(data,uid){const {diamonds,requestId}=data;if(!Number.isSafeInteger(diamonds)||diamonds<100||diamonds%100!==0||!validId(requestId))throw Error('invalid-exchange');const coins=diamonds/100*70,ref=db.doc(`users/${uid}`),receipt=db.doc(`walletRequests/${uid}_${requestId}`),diamondRef=db.doc(`diamondWallets/${uid}`);return db.runTransaction(async t=>{const [old,u,vault]=await Promise.all([t.get(receipt),t.get(ref),t.get(diamondRef)]);if(old.exists){if(old.data().type!=='diamond_exchange'||old.data().diamondsSpent!==diamonds)throw Error('request-conflict');return old.data();}const user=u.data();if(!active(user))throw Error('inactive-user');const before=Number(vault.data()?.balance||0),balance=Number(user.coins||0);if(!Number.isSafeInteger(before)||before<diamonds)throw Error('insufficient-diamonds');if(!Number.isSafeInteger(balance+coins))throw Error('invalid-balance');const result={type:'diamond_exchange',uid,diamondsSpent:diamonds,coinsAdded:coins,balance:balance+coins,diamonds:before-diamonds,requestId,createdAt:clock()};t.update(ref,{coins:result.balance,diamond:result.diamonds});t.set(diamondRef,{balance:result.diamonds,spent:Number(vault.data()?.spent||0)+diamonds},{merge:true});t.set(receipt,result);t.set(db.doc(`transactions/exchange_${uid}_${requestId}`),{...result,userId:uid});return result;});}
 async function voiceConfig(data,uid){const user=await db.doc(`users/${uid}`).get();if(!active(user.data())||typeof data.roomId!=='string'||user.data().currentRoomId!==data.roomId)throw Error('inactive-user');const control=await db.doc(`rooms/${data.roomId}/controls/${uid}`).get();if(control.data()?.blocked)throw Error('inactive-user');const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}];const secret=process.env.TURN_SHARED_SECRET,urls=process.env.TURN_URLS?.split(',').map(s=>s.trim()).filter(Boolean);if(secret&&urls?.length){const username=`${Math.floor(clock()/1000)+3600}:${uid}`,credential=createHmac('sha1',secret).update(username).digest('base64');iceServers.push({urls,username,credential});}return {iceServers,relayEnabled:!!secret&&!!urls?.length};}
 return {gift,luckyGift,exchange,voiceConfig};
}
