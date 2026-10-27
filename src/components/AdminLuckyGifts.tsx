import React,{useEffect,useRef,useState} from 'react';
import {walletApi} from '../lib/walletApi';
import {galleryImage} from './AdminExtensions';

const MULTIPLIERS=[5,10,50,100] as const;
// Example configuration. Nothing is billable until the owner explicitly enables it.
const INITIAL_ODDS:Record<string,number>={'5':500,'10':200,'50':50,'100':10};

export function AdminLuckyGifts({onToast}:{onToast:(message:string)=>void}){
 const [items,setItems]=useState<any[]>([]);
 const [enabled,setEnabled]=useState(false),[odds,setOdds]=useState<Record<string,number>>(INITIAL_ODDS);
 const [maxPayout,setMaxPayout]=useState('100000000');
 const [name,setName]=useState(''),[price,setPrice]=useState('100'),[image,setImage]=useState('');
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const pendingItemId=useRef<string|null>(null);
 useEffect(()=>{let mounted=true;
  void walletApi('lucky-gift',{action:'admin-settings'}).then((response:any)=>{
   if(!mounted)return;const config=response.settings||{};
   setEnabled(config.enabled===true);setOdds({...INITIAL_ODDS,...(config.chancesBps||{})});
   setMaxPayout(String(config.maxPayout||100000000));setItems(Array.isArray(response.items)?response.items:[]);
   setLoaded(true);
  },()=>{if(mounted){setLoaded(true);onToast('Lucky Gift settings সার্ভার থেকে লোড হয়নি।')}});
  return()=>{mounted=false};
 },[]);
 const totalChance=MULTIPLIERS.reduce((n,m)=>n+Number(odds[String(m)]||0),0);
 const expectedReturn=MULTIPLIERS.reduce((n,m)=>n+m*Number(odds[String(m)]||0),0)/100;
 async function refresh(){const result:any=await walletApi('lucky-gift',{action:'admin-settings'});
  setItems(Array.isArray(result.items)?result.items:[]);
 }
 async function save(){
  const limit=Number(maxPayout);
  if(!MULTIPLIERS.every(m=>Number.isSafeInteger(odds[String(m)])&&odds[String(m)]>=0&&odds[String(m)]<=10000)||
    totalChance>10000||!Number.isSafeInteger(limit)||limit<100||limit>1000000000){onToast('চান্স ও সর্বোচ্চ পুরস্কার ঠিক করুন।');return;}
  if(enabled&&!window.confirm('এই সেটিংসে Lucky Gift চালু হবে এবং আসল ওয়ালেট থেকে কয়েন কাটবে। নিশ্চিত?'))return;
  setBusy(true);try{await walletApi('lucky-gift',{action:'admin-save',settings:{
   enabled,chancesBps:Object.fromEntries(MULTIPLIERS.map(m=>[String(m),Number(odds[String(m)])])),maxPayout:limit
  }});onToast(enabled?'Lucky Gift চালু হয়েছে ✓':'Lucky Gift বন্ধ রাখা হয়েছে ✓')}
  catch{onToast('Lucky Gift settings সেভ হয়নি। মূল মালিকের অনুমতি ও নতুন সার্ভার পরীক্ষা করুন।')}
  finally{setBusy(false)}
 }
 async function upload(file?:File){if(!file)return;setBusy(true);try{setImage(await galleryImage(file))}
  catch(e){onToast((e as Error).message)}finally{setBusy(false)}}
 async function add(){const cost=Number(price);
  if(!image||!name.trim()||!Number.isSafeInteger(cost)||cost<1||cost>1000000){onToast('নাম, ছবি ও ১–১০,০০,০০০ কয়েনের দাম দিন।');return;}
  setBusy(true);try{pendingItemId.current ||= crypto.randomUUID();
   await walletApi('lucky-gift',{action:'admin-add-item',item:{id:pendingItemId.current,name:name.trim(),price:cost,image}});
   pendingItemId.current=null;await refresh();setName('');setImage('');onToast('Lucky Gift item যুক্ত হয়েছে ✓');}
  catch{onToast('Lucky Gift item যুক্ত করা যায়নি। আবার একই আইটেম দিয়ে চেষ্টা করুন।')}
  finally{setBusy(false)}
 }
 return <section className="admin-register" aria-label="Lucky Gift Management">
  <h2>🍀 Lucky Gifts — কয়েন ও জেতার নিয়ম</h2>
  <p>এই ফিচার ডিফল্টভাবে বন্ধ থাকে। ১০,০০০ বার গিফট পাঠানোর মধ্যে কতবার প্রতিটি গুণের পুরস্কার আসবে, তা নির্ধারণ করুন। শুধু সার্ভার ফলাফল বাছবে।</p>
  <label>Lucky Gift চালু করুন (পরীক্ষা শেষে)
   <input type="checkbox" checked={enabled} disabled={!loaded||busy} onChange={e=>setEnabled(e.target.checked)}/>
  </label>
  <div className="grid grid-cols-2 gap-2">{MULTIPLIERS.map(multiplier=><label key={multiplier}>{multiplier}× পুরস্কার — ১০,০০০-এর মধ্যে
   <input type="number" min="0" max="10000" step="1" disabled={busy} value={odds[String(multiplier)]??0}
    onChange={e=>setOdds({...odds,[String(multiplier)]:Number(e.target.value)})}/>
  </label>)}</div>
  <label>প্রতি Send-এ সর্বোচ্চ জেতার কয়েন<input type="number" min="100" max="1000000000" step="1" disabled={busy} value={maxPayout} onChange={e=>setMaxPayout(e.target.value)}/></label>
  <p>মোট জেতার সম্ভাবনা: {(totalChance/100).toFixed(2)}%। হিসাব অনুযায়ী গড়ে প্রতি ১০০ কয়েনে {expectedReturn.toFixed(2)} কয়েন ফেরত আসতে পারে (বাস্তবে ফল ভিন্ন হবে)।</p>
  <button disabled={busy||!loaded} onClick={()=>void save()}>{busy?'সেভ হচ্ছে…':'Lucky Gift সেটিংস সেভ করুন'}</button>
  <hr/>
  <h3>গ্যালারি থেকে Lucky Gift ছবি/অ্যানিমেশন</h3>
  <form onSubmit={e=>{e.preventDefault();void add()}}>
   <label>নাম<input maxLength={80} required value={name} onChange={e=>{setName(e.target.value);pendingItemId.current=null}}/></label>
   <label>দাম (কয়েন)<input type="number" min="1" max="1000000" required value={price} onChange={e=>{setPrice(e.target.value);pendingItemId.current=null}}/></label>
   <label>গ্যালারি GIF/PNG/WebP<input disabled={busy} type="file" accept="image/gif,image/png,image/jpeg,image/webp" onChange={e=>{void upload(e.target.files?.[0]);pendingItemId.current=null;e.target.value=''}}/></label>
   <button disabled={busy||!image}>Lucky Gift যোগ করুন</button>
  </form>
  {image&&<img src={image} alt="Lucky Gift preview" style={{width:110,height:110,objectFit:'contain'}}/>}
  <div className="admin-gift-media-grid">{items.filter(item=>item.active===true).map(item=><article key={item.id}><img src={item.image} alt={item.name}/><b>{item.name}</b><small>🪙 {item.price}</small><button disabled={busy} onClick={()=>{
    if(!window.confirm('এই Lucky Gift সরাবেন?'))return;
    setBusy(true);
    void walletApi('lucky-gift',{action:'admin-disable-item',itemId:item.id})
     .then(refresh).then(()=>onToast('Lucky Gift সরানো হয়েছে'),()=>onToast('সরানো যায়নি'))
     .finally(()=>setBusy(false));
   }}>সরান</button></article>)}</div>
 </section>;
}
