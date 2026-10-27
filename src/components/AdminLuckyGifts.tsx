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
  },()=>{if(mounted){setLoaded(true);onToast('Lucky Gift settings could not be loaded from the server.')}});
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
    totalChance>10000||!Number.isSafeInteger(limit)||limit<100||limit>1000000000){onToast('Enter valid winning odds and a maximum payout.');return;}
  if(enabled&&!window.confirm('Enabling Lucky Gifts will deduct coins from real wallets. Continue?'))return;
  setBusy(true);try{await walletApi('lucky-gift',{action:'admin-save',settings:{
   enabled,chancesBps:Object.fromEntries(MULTIPLIERS.map(m=>[String(m),Number(odds[String(m)])])),maxPayout:limit
  }});onToast(enabled?'Lucky Gifts enabled ✓':'Lucky Gifts remain disabled ✓')}
  catch{onToast('Lucky Gift settings were not saved. Check owner access and server connection.')}
  finally{setBusy(false)}
 }
 async function upload(file?:File){if(!file)return;setBusy(true);try{setImage(await galleryImage(file))}
  catch(e){onToast((e as Error).message)}finally{setBusy(false)}}
 async function add(){const cost=Number(price);
  if(!image||!name.trim()||!Number.isSafeInteger(cost)||cost<1||cost>1000000){onToast('Enter a name, image and coin price between 1 and 1,000,000.');return;}
  setBusy(true);try{pendingItemId.current ||= crypto.randomUUID();
   await walletApi('lucky-gift',{action:'admin-add-item',item:{id:pendingItemId.current,name:name.trim(),price:cost,image}});
   pendingItemId.current=null;await refresh();setName('');setImage('');onToast('Lucky Gift item added ✓');}
  catch{onToast('Could not add the Lucky Gift item. Retry with the same item.')}
  finally{setBusy(false)}
 }
 return <section className="admin-register" aria-label="Lucky Gift Management">
  <h2>🍀 Lucky Gifts — Coins and Winning Rules</h2>
  <p>This feature is disabled by default. Enter the number of winning outcomes per 10,000 gifts for each multiplier. Only the server draws results.</p>
  <label>Enable Lucky Gifts (after testing)
   <input type="checkbox" checked={enabled} disabled={!loaded||busy} onChange={e=>setEnabled(e.target.checked)}/>
  </label>
  <div className="grid grid-cols-2 gap-2">{MULTIPLIERS.map(multiplier=><label key={multiplier}>{multiplier}× wins per 10,000 gifts
   <input type="number" min="0" max="10000" step="1" disabled={busy} value={odds[String(multiplier)]??0}
    onChange={e=>setOdds({...odds,[String(multiplier)]:Number(e.target.value)})}/>
  </label>)}</div>
  <label>Maximum coin payout per send<input type="number" min="100" max="1000000000" step="1" disabled={busy} value={maxPayout} onChange={e=>setMaxPayout(e.target.value)}/></label>
  <p>Overall win probability: {(totalChance/100).toFixed(2)}%. Expected average return per 100 spent coins: {expectedReturn.toFixed(2)} coins (actual outcomes will vary).</p>
  <button disabled={busy||!loaded} onClick={()=>void save()}>{busy?'Saving…':'Save Lucky Gift Settings'}</button>
  <hr/>
  <h3>Upload Lucky Gift Images or Animations</h3>
  <form onSubmit={e=>{e.preventDefault();void add()}}>
   <label>Name<input maxLength={80} required value={name} onChange={e=>{setName(e.target.value);pendingItemId.current=null}}/></label>
   <label>Price (coins)<input type="number" min="1" max="1000000" required value={price} onChange={e=>{setPrice(e.target.value);pendingItemId.current=null}}/></label>
   <label>Gallery GIF/PNG/WebP<input disabled={busy} type="file" accept="image/gif,image/png,image/jpeg,image/webp" onChange={e=>{void upload(e.target.files?.[0]);pendingItemId.current=null;e.target.value=''}}/></label>
   <button disabled={busy||!image}>Add Lucky Gift</button>
  </form>
  {image&&<img src={image} alt="Lucky Gift preview" style={{width:110,height:110,objectFit:'contain'}}/>}
  <div className="admin-gift-media-grid">{items.filter(item=>item.active===true).map(item=><article key={item.id}><img src={item.image} alt={item.name}/><b>{item.name}</b><small>🪙 {item.price}</small><button disabled={busy} onClick={()=>{
    if(!window.confirm('Remove this Lucky Gift?'))return;
    setBusy(true);
    void walletApi('lucky-gift',{action:'admin-disable-item',itemId:item.id})
     .then(refresh).then(()=>onToast('Lucky Gift removed'),()=>onToast('Could not remove the gift'))
     .finally(()=>setBusy(false));
   }}>Remove</button></article>)}</div>
 </section>;
}
