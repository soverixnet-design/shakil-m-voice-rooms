import {useEffect} from 'react';
import {collection,doc,serverTimestamp} from 'firebase/firestore';
import {auth,db} from '../firebase';
import {onSnapshot,orderBy,limit,query,setDoc,where} from './reliableFirestore';
export function useMessageNotifications(uid:string|undefined,verified:boolean){
 useEffect(()=>{const native=(window as any).EarnBDMessagePush;native?.bindUser(verified&&uid?uid:'');if(!verified||!uid)return;
  let saved='',busy=false,stopped=false;
  async function register(){if(!native||busy)return;try{const info=JSON.parse(native.registration()||'{}');if(!info.token||!info.id||saved===info.token)return;busy=true;await setDoc(doc(db,'pushDevices',info.id),{userId:uid,token:info.token,updatedAt:serverTimestamp()});if(!stopped)saved=info.token;}catch{}finally{busy=false}}
  void register();const timer=setInterval(()=>void register(),10000);
  const seen=new Set<string>();let first=true;const off=onSnapshot(query(collection(db,'directMessages'),where('receiverId','==',uid),orderBy('createdAt','desc'),limit(300)),snapshot=>{for(const message of snapshot.docs){if(first||seen.has(message.id)){seen.add(message.id);continue;}seen.add(message.id);const data=message.data();if(native||document.visibilityState!=='hidden'||typeof Notification==='undefined'||Notification.permission!=='granted'||Date.now()-(data.createdAt?.toMillis?.()||0)>120000)continue;void navigator.serviceWorker?.ready.then(registration=>registration.showNotification('EarnBD · নতুন মেসেজ',{body:'আপনাকে একটি ব্যক্তিগত মেসেজ পাঠানো হয়েছে।',tag:'dm-'+message.id,data:{senderId:data.senderId}})).catch(()=>{});}first=false;},()=>{});
  return()=>{stopped=true;clearInterval(timer);off();native?.bindUser('')};
 },[uid,verified]);
}
export async function enableMessageNotifications(){const native=(window as any).EarnBDMessagePush;if(native){native.requestPermission();return native.permissionGranted()?'ফোনের মেসেজ নোটিফিকেশন চালু আছে।':'ফোনে নোটিফিকেশনের অনুমতি দিন।'}if(typeof Notification!=='undefined'){const result=await Notification.requestPermission();return result==='granted'?'এই ব্রাউজারে নোটিফিকেশন চালু হয়েছে। অ্যাপ বন্ধ থাকলেও পেতে Android 1.10 ইনস্টল করুন।':'নোটিফিকেশনের অনুমতি দেওয়া হয়নি।'}return 'ফোনের নোটিফিকেশনের জন্য Android 1.10 ইনস্টল করুন।';}
