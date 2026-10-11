import {useMediaAssets,MediaAvatar} from './MediaAssets';
import React, { useEffect, useRef, useState } from 'react';
import { auth, db } from '../firebase';
import {sendDirectGift} from '../lib/gifts';
import { collection, doc, onSnapshot } from 'firebase/firestore';
const GIFTS = [{emoji:'🌹',name:'গোলাপ',cost:10},{emoji:'❤️',name:'হার্ট',cost:1},{emoji:'⭐',name:'স্টার',cost:250},{emoji:'💎',name:'ডায়মন্ড',cost:1100},{emoji:'🚀',name:'রকেট',cost:5000},{emoji:'👑',name:'ক্রাউন',cost:15000}];
export function UserDirectory({onClose,onJoin,roomId,initialRecipient,onGiftSent}:{onClose:()=>void;onJoin:(room:any)=>void;roomId?:string;initialRecipient?:string;onGiftSent?:(event:any)=>void}) {
  const [users,setUsers]=useState<any[]>([]),[search,setSearch]=useState(''),[selected,setSelected]=useState(initialRecipient||''),[gift,setGift]=useState(0),[quantity,setQuantity]=useState(1),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[now,setNow]=useState(Date.now()),[animation,setAnimation]=useState(false),[animationGift,setAnimationGift]=useState<any>(null);
  const [catalog,setCatalog]=useState(GIFTS);
  useEffect(()=>onSnapshot(doc(db,'system','config'),snapshot=>{const gifts=snapshot.data()?.customGifts;if(Array.isArray(gifts)){setCatalog(gifts.filter(g=>Number.isSafeInteger(g.price)&&g.price>0).map(g=>({emoji:g.icon,name:g.name,cost:g.price})));setGift(0)}}),[]);
  const media=useMediaAssets();
  const gifts:any[]=catalog.concat(media.filter(a=>a.kind==='gift'&&Number.isSafeInteger(a.price)&&a.price>0).map(a=>({emoji:'🎁',name:a.name,cost:a.price,image:a.image})));
  const lock=useRef(false),avatar=useRef<HTMLDivElement>(null),particle=useRef<HTMLSpanElement>(null);
  useEffect(()=>onSnapshot(collection(db,'users'),snapshot=>{setUsers(snapshot.docs.map(d=>({...d.data(),uid:d.id})));setLoading(false);setError('')},()=>{setLoading(false);setError('ইউজার তালিকা লোড হয়নি। Google লগইন ও সংযোগ পরীক্ষা করুন।')}),[]);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(t)},[]);
  const online=(u:any)=>u.online===true&&now-(u.lastSeen?.toMillis?.()||0)<90000;
  const target=users.find(u=>u.uid===selected),item=gifts[gift],cost=(item?.cost||0)*quantity;
  const filtered=users.filter(u=>!['banned','archived'].includes(u.status)).filter(u=>search.trim()?String(u.id||'')===search.trim()||String(u.uid)===search.trim()||String(u.name||'').toLowerCase().includes(search.trim().toLowerCase()):!roomId||u.currentRoomId===roomId);
  async function sendGift(){
    if(lock.current)return;
    if(!item||!Number.isSafeInteger(cost)||cost<=0){setStatus('সঠিক গিফট বেছে নিন।');return}
    if(!auth.currentUser||!target){setStatus('একটি নিবন্ধিত ইউজার বেছে নিন।');return}
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>999){setStatus('গিফটের সংখ্যা ১–৯৯৯ দিন।');return}
    lock.current=true;setBusy(true);setStatus('গিফট সেভ হচ্ছে…');
    const recipient={...target},sender=auth.currentUser;
    try{
      const result=await sendDirectGift(db,{senderId:sender.uid,receiverId:recipient.uid,roomId,item,quantity});
      setStatus(`✅ সফল — ID ${recipient.id}: ${quantity}টি ${item.name} পৌঁছেছে। খরচ ${cost.toLocaleString()} কয়েন। আপনার বাকি ${result.balance.toLocaleString()} কয়েন। লেনদেন: ${result.id}`);
      if(onGiftSent&&roomId&&result.roomId===roomId){onGiftSent?.(result);return;}
      setAnimationGift(result);setAnimation(true);requestAnimationFrame(()=>{const destination=avatar.current?.getBoundingClientRect(),origin=particle.current?.getBoundingClientRect();if(destination&&origin)particle.current?.animate([{transform:'translate(0,0) scale(.5)',opacity:0},{opacity:1,offset:.2},{transform:`translate(${destination.left+destination.width/2-origin.left-origin.width/2}px,${destination.top+destination.height/2-origin.top-origin.height/2}px) scale(1.6)`,opacity:1},{transform:`translate(${destination.left+destination.width/2-origin.left-origin.width/2}px,${destination.top+destination.height/2-origin.top-origin.height/2}px) scale(.2)`,opacity:0}],{duration:1600,easing:'ease-in-out'});});setTimeout(()=>setAnimation(false),1700);
    }catch(e){setStatus(`❌ গিফট পাঠানো হয়নি: ${(e as any)?.code==='permission-denied'?'নতুন giftEvents রুলস Publish করুন। কয়েন কাটা হয়নি।':e instanceof Error?e.message:'সংযোগ বা অনুমতি পরীক্ষা করুন।'}`)}finally{lock.current=false;setBusy(false)}
  }
  return <div className="fixed inset-0 z-[80] bg-[#0a1024] text-white overflow-y-auto p-4"><div className="max-w-lg mx-auto space-y-4">
    <div className="flex justify-between items-center"><h2 className="text-xl font-bold">🔍 ইউজার খুঁজুন ও গিফট দিন</h2><button disabled={busy} className="ib" onClick={onClose}>✕</button></div>
    {auth.currentUser&&<button disabled={busy} className="b t w-full" onClick={()=>{setSelected(auth.currentUser!.uid);setSearch('');setStatus('')}}>🎁 নিজের আইডিতে গিফট দিন</button>}
    <label className="block">ইউজার ID<input className="in w-full mt-2" disabled={busy} value={search} onChange={e=>{setSearch(e.target.value);setStatus('')}} placeholder="ইউজার ID বা নাম লিখুন" /></label>
    {loading&&<p>লোড হচ্ছে…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!filtered.length&&<p>ইউজার পাওয়া যায়নি। নিবন্ধিত প্রোফাইলের ID দিন।</p>}
    <div className="space-y-2">{(initialRecipient&&!search?[]:filtered).map(u=><button disabled={busy} key={u.uid} onClick={()=>{setSelected(u.uid);setStatus('')}} className={`gl p-3 w-full text-left flex gap-3 items-center ${selected===u.uid?'border-cyan-400':''}`}>
      <MediaAvatar avatar={u.avatar} frame={media.find(a=>a.id===u.customFrameId)?.image}/><span className="flex-1"><b>{u.name||'ইউজার'}</b><small className="block">ID {u.id||u.uid}</small><span className={online(u)?'text-green-400':'text-gray-400'}>{online(u)?'🟢 অনলাইন':'⚪ অফলাইন'}</span>{online(u)&&u.activeRoom&&<small className="block">🎙️ {u.activeRoom.name} · রুম {u.currentRoomId}</small>}</span></button>)}</div>
    {target&&<section className="gl p-4 space-y-3"><div className="text-center rounded-2xl border border-purple-400/30 p-3"><div ref={avatar} className="inline-block"><MediaAvatar avatar={target.avatar} size={88} frame={media.find(a=>a.id===target.customFrameId)?.image}/></div><h3>{target.name} · ID {target.id}</h3><p>{online(target)?'🟢 অনলাইন':'⚪ অফলাইন'}</p><p>পাওয়া গিফট: {Number(target.giftReceivedCount||0).toLocaleString()}টি · মূল্য 🪙 {Number(target.giftReceivedCoins||0).toLocaleString()}</p></div>
      {online(target)&&target.activeRoom&&<button className="b t w-full" onClick={()=>onJoin({...target.activeRoom,own:target.activeRoom.hostId===auth.currentUser?.uid})}>🎙️ এই ইউজারের রুমে যান</button>}
      <label className="block">গিফট<select disabled={busy} className="in w-full" value={gift} onChange={e=>setGift(Number(e.target.value))}>{gifts.map((g,i)=><option key={g.name} value={i}>{g.emoji} {g.name} — {g.cost} কয়েন</option>)}</select></label>
      {item?.image&&<img src={item.image} className="h-28 mx-auto object-contain" alt={item.name}/>}
      <label className="block">সংখ্যা<input className="in w-full" disabled={busy} type="number" min="1" max="999" value={quantity} onChange={e=>setQuantity(Number(e.target.value))} /></label>
      <p>প্রাপক: ID {target.id} · {quantity}টি · মোট খরচ 🪙 {Number.isSafeInteger(cost)?cost.toLocaleString():'—'}</p>
      <button className="b g w-full" disabled={busy||!item} onClick={sendGift}>{busy?'পাঠানো হচ্ছে…':'🎁 এই ইউজারকে গিফট পাঠান'}</button>
      {animation&&<span ref={particle} className="fixed bottom-20 left-1/2 text-5xl pointer-events-none z-[90]">{animationGift?.giftImage?<img src={animationGift.giftImage} alt={animationGift.giftName} className="w-20 h-20 object-contain"/>:animationGift?.emoji}</span>}
      <p role="status" className="break-words text-green-200">{status}</p>
    </section>}
  </div></div>
}
