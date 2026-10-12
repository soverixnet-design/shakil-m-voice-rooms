import React,{useEffect,useState} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';
import fallback from '../../game-server-config.json';
import {gameServerUrl} from '../lib/gameServerUrl';
export function ServerStatus(){
  const [url,setUrl]=useState(fallback.url),[state,setState]=useState('checking'),[retry,setRetry]=useState(0),[detail,setDetail]=useState('');
  useEffect(()=>onSnapshot(doc(db,'system','gameServer'),s=>setUrl(s.data()?.url||fallback.url),()=>setState('unavailable')),[]);
  useEffect(()=>{const c=new AbortController();let stopped=false;setState('checking');setDetail('');const timeout=setTimeout(()=>c.abort(),75000);void (async()=>{try{const r=await fetch(`${gameServerUrl(url)}/health`,{signal:c.signal});const data=await r.json();if(!r.ok||data.status!=='ok'||data.service!=='earnbd-shared-games'){const messages:Record<string,string>={'database-quota-exceeded':'Firebase database quota is exhausted. Contact the owner.','server-database-permission-denied':'Render cannot access the Firebase database. Check service account permissions.','database-connection-failed':'The server could not connect to Firebase. Please retry.'};if(!stopped)setDetail(messages[data.reason]||'Server database connection is unavailable.');throw Error();}if(!stopped)setState('ready')}catch{if(!stopped)setState('unavailable')}finally{clearTimeout(timeout)}})();return()=>{stopped=true;c.abort();clearTimeout(timeout)}},[url,retry]);
  return <div><button className={'ref-server '+state} onClick={()=>setRetry(x=>x+1)} title="সার্ভার সংযোগ আবার পরীক্ষা করুন" aria-live="polite">{state==='ready'?'● সার্ভার সংযুক্ত':state==='checking'?'◌ সার্ভার যাচাই হচ্ছে…':'↻ সংযোগ আবার পরীক্ষা করুন'}</button>{detail&&<p role="alert" className="server-diagnostic">{detail}</p>}</div>;
}
