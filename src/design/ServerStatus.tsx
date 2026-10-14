import {isDirectVoiceRelayMissing} from '../lib/voiceHealth';
import {onSnapshot} from '../lib/reliableFirestore';
import React,{useEffect,useState} from 'react';
import {doc} from 'firebase/firestore';
import {db} from '../firebase';
import fallback from '../../game-server-config.json';
import {gameServerUrl} from '../lib/gameServerUrl';
export function ServerStatus(){
  const [url,setUrl]=useState(fallback.url),[state,setState]=useState('checking'),[retry,setRetry]=useState(0),[detail,setDetail]=useState(''),[voiceRelayMissing,setVoiceRelayMissing]=useState(false);
  useEffect(()=>{const quota=()=>{setState('unavailable');setDetail('Firebase daily write quota is exhausted. Room, game and voice updates cannot be saved.');};window.addEventListener('earnbd-database-quota',quota);return()=>window.removeEventListener('earnbd-database-quota',quota)},[]);
  useEffect(()=>onSnapshot(doc(db,'system','gameServer'),s=>setUrl(s.data()?.url||fallback.url),()=>setState('unavailable')),[]);
  useEffect(()=>{
    let stopped=false,inFlight=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
    setState('checking');setDetail('');setVoiceRelayMissing(false);
    const check=async()=>{
      if(stopped||inFlight)return;
      if(timer)clearTimeout(timer);
      inFlight=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),75000);
      try{
        const r=await fetch(`${gameServerUrl(url)}/health`,{signal:controller.signal,cache:'no-store'});const data=await r.json();
        if(stopped)return;
        setVoiceRelayMissing(isDirectVoiceRelayMissing(data));
        if(!r.ok||data.status!=='ok'||data.service!=='earnbd-shared-games'){
          const database=data.socialDatabase==='supabase'?'Supabase':'Firebase';
          const messages:Record<string,string>={'database-quota-exceeded':'Firebase daily write quota is exhausted. Room, game and voice updates cannot be saved.','server-database-permission-denied':`The server cannot access ${database}. Check database permissions.`,'database-connection-failed':`The server could not connect to ${database}. Connection will be checked again automatically.`};
          setDetail(messages[data.reason]||'Server database connection is unavailable. Connection will be checked again automatically.');setState('unavailable');
        }else{setDetail('');setState('ready')}
      }catch{if(!stopped){setState('unavailable');setDetail('Server connection failed. Connection will be checked again automatically.')}}
      finally{clearTimeout(timeout);inFlight=false;if(!stopped)timer=setTimeout(()=>void check(),35000)}
    };
    const resume=()=>{if(document.visibilityState==='visible')void check()};
    window.addEventListener('online',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    void check();
    return()=>{stopped=true;controller?.abort();if(timer)clearTimeout(timer);window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)};
  },[url,retry]);
  return <div><button className={'ref-server '+state} onClick={()=>setRetry(x=>x+1)} title="সার্ভার সংযোগ আবার পরীক্ষা করুন" aria-live="polite">{state==='ready'?'● সার্ভার সংযুক্ত':state==='checking'?'◌ সার্ভার যাচাই হচ্ছে…':'↻ সংযোগ আবার পরীক্ষা করুন'}</button>{detail&&<p role="alert" className="server-diagnostic">{detail}</p>}{voiceRelayMissing&&<p className="server-diagnostic">Voice relay is not configured. Some mobile networks cannot connect audio directly.</p>}</div>;
}
