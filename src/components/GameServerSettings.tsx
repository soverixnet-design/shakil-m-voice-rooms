import {onSnapshot,setDoc} from '../lib/reliableFirestore';
import React,{useEffect,useState} from 'react';
import {doc,serverTimestamp} from 'firebase/firestore';
import {auth,db} from '../firebase';
import {gameServerUrl} from '../lib/gameServerUrl';
export function GameServerSettings(){const [url,setUrl]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);const user=auth.currentUser;
 useEffect(()=>onSnapshot(doc(db,'system','gameServer'),s=>setUrl(String(s.data()?.url||''))),[]);
 if(!user?.emailVerified||user.email?.toLowerCase()!=='yfastvpn@gmail.com')return null;
 async function save(){setBusy(true);try{const base=gameServerUrl(url);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),75000);let response;try{response=await fetch(`${base}/health`,{signal:controller.signal});const data=await response.json();if(!response.ok||data.status!=='ok'||data.service!=='earnbd-shared-games')throw Error('সার্ভার প্রস্তুত নয়। Render-এর Firebase Secret File ও Logs পরীক্ষা করুন।');}finally{clearTimeout(timer)}await setDoc(doc(db,'system','gameServer'),{url:base,updatedAt:serverTimestamp()});setUrl(base);setStatus('✅ সার্ভার সংযোগ সেভ হয়েছে। গেম আবার খুলুন।')}catch(e){setStatus(e instanceof Error?e.message:'সংযোগ হয়নি।')}finally{setBusy(false)}}
 return <section className="gl p-4 space-y-3"><h3 className="font-bold">🎮 গেম সার্ভার সংযোগ</h3><p className="text-sm">Render deploy সফল হলে তার https://নাম.onrender.com লিংক এখানে দিন। প্রথমবার সার্ভার চালু হতে প্রায় এক মিনিট লাগতে পারে।</p><input className="in w-full" aria-label="Render গেম সার্ভারের URL" placeholder="https://আপনার-সার্ভার.onrender.com" value={url} disabled={busy} onChange={e=>setUrl(e.target.value)}/><button className="b t" disabled={busy} onClick={()=>void save()}>{busy?'Checking server…':'Verify and save connection'}</button><p role="status">{status}</p><p className="text-xs">এখানে সার্ভারের লিংক দেবেন। Firebase private key শুধু Render-এর Secret Files-এ রাখবেন।</p></section>
}
