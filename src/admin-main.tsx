import {signInWithEmailAndPassword} from 'firebase/auth';
import {onSnapshot,runTransaction} from './lib/reliableFirestore';
import {LanguagePicker} from './i18n/LanguagePicker';
import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {auth,db,googleProvider,onAuthStateChanged,signInWithPopup,signOut} from './firebase';
import {collection,doc,serverTimestamp} from 'firebase/firestore';
import {AdminExtensions,useAccess} from './components/AdminExtensions';
import {AdminPanel} from './components/AdminPanel';
import {DEFAULT_CUSTOM_GIFTS} from './admin-defaults';
import './index.css';
import './design/reference.css';
const OWNER='yfastvpn@gmail.com';
export const isOwner=(user:any)=>Boolean(user?.emailVerified&&user.email?.toLowerCase()===OWNER);
function AdminPortal(){
 const [user,setUser]=useState<any>(null),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loaded,setLoaded]=useState(false);
 const [state,setState]=useState<any>({name:'অ্যাডমিন',av:'👑',coins:0,svip:0,userList:[],rooms:[],rechargeRequests:[],customGifts:DEFAULT_CUSTOM_GIFTS,pk:[{u:1,c:1000},{u:5,c:5500},{u:10,c:12000},{u:20,c:26000},{u:50,c:70000},{u:100,c:150000}],bn:{t:'ভয়েস রুমে আড্ডা দিন, গিফট পাঠান, গেম খেলুন! 🎉',g:0},invPct:5,welcomeCoins:50000});
 const access=useAccess(user),delegated=Boolean(access?.active&&Object.values(access.permissions||{}).some(Boolean));
 const [extensions,setExtensions]=useState(false);
 const lock=useRef(false);
 const [username,setUsername]=useState(''),[password,setPassword]=useState('');
 async function staffLogin(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await signInWithEmailAndPassword(auth,username.trim().toLowerCase()+'@staff.earnbd.work',password);setPassword('')}catch{setMessage('ইউজারনেম বা পাসওয়ার্ড সঠিক নয়, অথবা অ্যাকাউন্ট চালু নেই।')}finally{setBusy(false)}}
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setChecking(false);setLoaded(false)}),[]);
 useEffect(()=>{
  if(!isOwner(user))return;
  const ready=new Set<string>();let active=true;
  const mark=(key:string)=>{ready.add(key);if(active&&ready.size===3)setLoaded(true)};
  const error=()=>{if(active)setMessage('Firebase ডেটা লোড হয়নি। অনুমতি ও সংযোগ পরীক্ষা করুন।')};
  const stops=[
   onSnapshot(doc(db,'system','config'),s=>{setState((p:any)=>({...p,...(s.data()||{})}));mark('config')},error),
   onSnapshot(doc(db,'users',user.uid),s=>{setState((p:any)=>({...p,...(s.data()||{}),name:s.data()?.name||user.displayName||'অ্যাডমিন',av:s.data()?.avatar||'👑',id:s.data()?.id||user.uid}));mark('profile')},error),
   onSnapshot(collection(db,'rooms'),s=>{setState((p:any)=>({...p,rooms:s.docs.filter(d=>!d.data().archived).map(d=>({...d.data(),id:d.id}))}));mark('rooms')},error)
  ];return()=>{active=false;stops.forEach(stop=>stop())};
 },[user?.uid]);
 useEffect(()=>{if(!user||isOwner(user))return;return onSnapshot(doc(db,'users',user.uid),s=>{if(['banned','archived'].includes(s.data()?.status)){setMessage('আপনার অ্যাকাউন্ট ব্লক করা হয়েছে।');void signOut(auth)}})},[user?.uid]);
 async function login(){setBusy(true);setMessage('');try{await signInWithPopup(auth,googleProvider)}catch{setMessage('Google লগইন হয়নি। এই লিংকটি Chrome-এ খুলে আবার চেষ্টা করুন।')}finally{setBusy(false)}}
 async function updateCoins(amount:number,reason:string){
  if(lock.current||!isOwner(auth.currentUser)||!Number.isSafeInteger(amount))return false;
  lock.current=true;
  try{const uid=auth.currentUser!.uid,ledger=doc(collection(db,'transactions'));await runTransaction(db,async t=>{const ref=doc(db,'users',uid),s=await t.get(ref);if(!s.exists())throw Error();const before=Number(s.data().coins||0),after=before+amount;if(!Number.isSafeInteger(after)||after<0)throw Error();t.update(ref,{coins:after});t.set(ledger,{type:'admin-adjustment',userId:uid,adminId:uid,amount,balanceBefore:before,balanceAfter:after,reason,createdAt:serverTimestamp()})});return true}catch{setMessage('কয়েন সেভ হয়নি। অনুমতি, ব্যালেন্স ও সংযোগ পরীক্ষা করুন।');return false}finally{lock.current=false}
 }
 return <div id="app" className="admin-portal"><div className="ref-language-bar"><LanguagePicker/></div><div className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] w-[92%] max-w-xl pointer-events-none">{message&&<div role="status" className="gl p-3 text-center shadow-xl pointer-events-auto">{message}<button className="ml-4" onClick={()=>setMessage('')}>✕</button></div>}</div>
 {user&&!isOwner(user)&&delegated?<AdminExtensions user={user} onBack={()=>void signOut(auth)}/>:isOwner(user)&&extensions?<AdminExtensions user={user} onBack={()=>setExtensions(false)}/>:isOwner(user)&&loaded?<><button className="admin-content-link" onClick={()=>setExtensions(true)}>🖼️ কনটেন্ট / সাপোর্ট / অনুমতি</button><AdminPanel currentUser={user} appState={state} onUpdateAppState={setState} onToast={setMessage} onClose={()=>void signOut(auth)} onUpdateCoins={updateCoins}/></>:<main className="min-h-screen flex items-center justify-center p-5"><section className="admin-login-card gl p-8 w-full max-w-md text-center space-y-5"><div className="text-5xl">🛡️</div><h1 className="text-2xl font-bold">Shakil M অ্যাডমিন কন্ট্রোল</h1><p className="text-slate-300">ইউজার ID দিয়ে রিচার্জ, ব্যালেন্স, রুম ও গিফট পরিচালনা করুন।</p>{checking?<p>লগইন পরীক্ষা হচ্ছে…</p>:isOwner(user)?<p>আপনার ড্যাশবোর্ডের ডেটা লোড হচ্ছে…</p>:user?<><p role="alert" className="text-amber-300">এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।</p><button className="b t w-full" onClick={()=>void signOut(auth)}>অ্যাকাউন্ট পরিবর্তন করুন</button></>:<><form onSubmit={staffLogin} className="space-y-3"><label className="block">স্টাফ ইউজারনেম<input required className="in w-full" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="block">পাসওয়ার্ড<input required type="password" className="in w-full" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="b g w-full" disabled={busy}>স্টাফ লগইন</button></form><p>মালিক বা অনুমতিপ্রাপ্ত অ্যাডমিনের Google অ্যাকাউন্টে প্রবেশ করুন।</p><button disabled={busy} className="b g w-full" onClick={login}>{busy?'লগইন হচ্ছে…':'Google দিয়ে অ্যাডমিন লগইন'}</button></>}<a href="./" className="block text-cyan-300">মূল অ্যাপ খুলুন ↗</a></section></main>}
 </div>
}
createRoot(document.getElementById('root')!).render(<AdminPortal/>);
