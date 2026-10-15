import React,{useEffect,useState} from 'react';
import {walletApi} from '../lib/walletApi';
export function DeviceBans({uid}:{uid:string}){
 const [rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[reason,setReason]=useState('');
 async function run(action:string){setBusy(true);setStatus('');try{const result=await walletApi('devices',{action,uid,reason});setRows(result.devices);setStatus(action==='list'?'':action==='ban'?'ডিভাইস ব্যান হয়েছে ✓':'ডিভাইস আনব্যান হয়েছে ✓')}catch{setStatus('সেভ হয়নি। সংযোগ ও আপনার অনুমতি যাচাই করুন।')}finally{setBusy(false)}}
 useEffect(()=>{setRows([]);void run('list')},[uid]);
 return <div className="gl p-4 space-y-3"><h3>ডিভাইস ব্যান</h3><p>এই ID দিয়ে আগে ব্যবহার করা অ্যাপের ডিভাইসগুলো ব্যান হবে। একই সংরক্ষিত ডিভাইস থেকে অন্য ID দিয়েও প্রবেশ বন্ধ থাকবে। অ্যাপের ডেটা মুছলে পরিচয় বদলাতে পারে।</p>{rows.map(r=><p key={r.key}>{r.key.slice(0,12)}… · {r.banned?'ব্যান করা':'সচল'}</p>)}{!rows.length&&<p>ডিভাইস পাওয়া যায়নি। ইউজারকে আপডেট হওয়া অ্যাপ একবার খুলতে হবে।</p>}<input className="in w-full" placeholder="ব্যানের কারণ" maxLength={300} value={reason} onChange={e=>setReason(e.target.value)}/><button className="b r" disabled={busy||!rows.length} onClick={()=>void run('ban')}>সব নিবন্ধিত ডিভাইস ব্যান</button><button className="b" disabled={busy||!rows.length} onClick={()=>void run('unban')}>ডিভাইস আনব্যান</button><p role="status">{status}</p></div>
}
