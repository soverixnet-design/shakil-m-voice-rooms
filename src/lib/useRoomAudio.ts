import {updateVoicePublication,voiceFailure} from './voicePublication';
import {retryableVoiceConnection} from './voiceConnection';
import {withTimeout} from './authTimeout';
import {useEffect,useRef,useState} from 'react';
import type {IAgoraRTCClient,IMicrophoneAudioTrack,IAgoraRTC} from 'agora-rtc-sdk-ng';
import {walletApi} from './walletApi';
export function useRoomAudio(roomId:string,micOn:boolean,soundOn:boolean,canSpeak:boolean,controls:Record<string,any>,enabled=true){
 const [micLevel,setMicLevel]=useState(0),[remoteAudioCount,setRemoteAudioCount]=useState(0),[connectionState,setConnectionState]=useState('DISCONNECTED');
 const [status,setStatus]=useState(''),[speakers,setSpeakers]=useState<string[]>([]),[audioBlocked,setAudioBlocked]=useState(false),[speaking,setSpeaking]=useState(false);
 const flags=useRef({micOn,soundOn,canSpeak,controls});flags.current={micOn,soundOn,canSpeak,controls};
 const error=useRef(''),sdk=useRef<IAgoraRTC|null>(null),intent=useRef(false);
 const local=useRef<IMicrophoneAudioTrack|null>(null),current=useRef<{client?:IAgoraRTCClient;start:()=>Promise<void>;update:(force?:boolean)=>Promise<boolean>;dead:boolean}|null>(null);
 function playback(){for(const user of current.current?.client?.remoteUsers||[]){const off=!flags.current.soundOn||flags.current.controls[String(user.uid)]?.muted||flags.current.controls[String(user.uid)]?.blocked;user.audioTrack?.setVolume(off?0:100);if(!off)user.audioTrack?.play();}}
 function unlock(){try{const result=sdk.current?.resumeAudioContext();void Promise.resolve(result).then(()=>{setAudioBlocked(false);playback()},()=>setAudioBlocked(true));}catch{setAudioBlocked(true);}}
 async function permission(){
  if(!enabled||!flags.current.canSpeak){error.current='মাইক চালু করতে আগে সিটে বসুন।';setStatus(error.current);return false;}
  const session=current.current;error.current='';intent.current=true;unlock();
  try{
   if(!session||session.dead)throw Error('voice-not-ready');
   if(!local.current){const {default:AgoraRTC}=await import('agora-rtc-sdk-ng');const track=await AgoraRTC.createMicrophoneAudioTrack({AEC:true,ANS:true,AGC:true});if(session.dead||current.current!==session){track.close();throw Error('voice-not-ready');}await track.setEnabled(false);local.current=track;}
   await withTimeout(session.start(),120000);
   if(session.dead||current.current!==session)throw Error('voice-not-ready');
   if(!await session.update(true))throw Error('voice-not-ready');
   error.current='';return true;
  }catch(e:any){intent.current=false;if(!error.current)error.current=voiceFailure(e);setStatus(error.current);return false;}
 }
 useEffect(()=>{
  if(!enabled)return;
  let dead=false,client:IAgoraRTCClient|undefined,queue=Promise.resolve(),published=false,joinedConfig:any,refreshPending:Promise<boolean>|undefined;
  const alive=()=>!dead&&current.current===session;
  const report=(e:any)=>{if(alive()){error.current=voiceFailure(e);setStatus(error.current);setSpeaking(false);}};
  function audible(){if(!alive()||!client)return;setSpeakers(client.remoteUsers.filter(u=>u.hasAudio&&!flags.current.controls[String(u.uid)]?.muted&&!flags.current.controls[String(u.uid)]?.blocked).map(u=>String(u.uid)));playback();}
  const connection=retryableVoiceConnection(async()=>{
   if(client){client.removeAllListeners();await client.leave().catch(()=>{});published=false;session.client=undefined;}
   if(alive())setStatus('ভয়েস সার্ভারের অনুমতি যাচাই হচ্ছে…');const config=await walletApi('voice-config',{roomId});joinedConfig=config;if(!alive())throw Error('voice-not-ready');
   if(config.provider!=='agora')throw Error('agora-not-configured');
   const {default:AgoraRTC}=await import('agora-rtc-sdk-ng');if(!alive())throw Error('voice-not-ready');sdk.current=AgoraRTC;
   AgoraRTC.setLogLevel(3);client=AgoraRTC.createClient({mode:'live',codec:'vp8'});session.client=client;
   client.on('user-published',async(user,type)=>{if(type!=='audio'||!alive())return;try{await client!.subscribe(user,type);audible();}catch(e){report(e);}});
   client.on('user-unpublished',audible);client.on('user-left',audible);
   client.on('token-privilege-will-expire',()=>{void session.update();});
   client.on('token-privilege-did-expire',()=>{void session.update();});
   client.on('connection-state-change',state=>{if(alive()){setConnectionState(state);if(state==='DISCONNECTED'){connection.reset();setSpeaking(false);}setStatus(state==='CONNECTED'?'ভয়েস সংযোগ হয়েছে।':state==='RECONNECTING'?'ভয়েস আবার সংযোগ হচ্ছে…':'ভয়েস সংযোগ হচ্ছে…');}});
   try{await client.setClientRole('audience');await withTimeout(client.join(config.appId,config.channel,config.token,config.uid),30000);
    if(!alive())throw Error('voice-not-ready');
    for(const user of client.remoteUsers)if(user.hasAudio)await client.subscribe(user,'audio');audible();
   }catch(e){client.removeAllListeners();await client.leave().catch(()=>{});published=false;session.client=undefined;throw e;}
  });
  const session:{client?:IAgoraRTCClient;start:()=>Promise<void>;update:(force?:boolean)=>Promise<boolean>;dead:boolean}={dead:false,start:()=>connection.start(),update(force){
   if(!force&&refreshPending)return refreshPending;
   const task=queue.then(async()=>{await connection.start();if(!alive()||!client)return false;
    const wants=(force===true||intent.current||flags.current.micOn)&&flags.current.canSpeak;
    if(local.current&&!wants)await local.current.setEnabled(false);
    const config=!force&&joinedConfig?joinedConfig:await walletApi('voice-config',{roomId});joinedConfig=undefined;
    const result=await updateVoicePublication({client,track:local.current,config,wants,allowed:()=>flags.current.canSpeak&&(force===true||intent.current||flags.current.micOn),alive,published});published=result.published;
    if(force===true&&!result.speaking)throw Error('seat-permission-required');
    if(alive()){for(const remote of client.remoteUsers)if(remote.hasAudio&&!remote.audioTrack)await client.subscribe(remote,'audio').catch(()=>{});error.current='';setSpeaking(result.speaking);setStatus(result.speaking?'মাইক চালু হয়েছে।':'ভয়েস সংযোগ হয়েছে। মাইক বন্ধ আছে।');audible();}return force===true?result.speaking:true;
   }).catch(async e=>{if(alive()){if(local.current)await local.current.setEnabled(false).catch(()=>{});if(client&&published){await client.unpublish().catch(()=>{});published=false;}report(e);}return false;});queue=task.then(()=>{});if(!force){refreshPending=task;void task.finally(()=>{if(refreshPending===task)refreshPending=undefined;});}return task;
  }};
  current.current=session;intent.current=false;error.current='';
  const autoplay=()=>{if(alive())setAudioBlocked(true);};
  void import('agora-rtc-sdk-ng').then(({default:AgoraRTC})=>{if(alive())AgoraRTC.on('autoplay-failed',autoplay);});
  const meter=setInterval(()=>{if(!alive())return;setMicLevel(local.current?.getVolumeLevel()||0);setRemoteAudioCount(client?.remoteUsers.filter(u=>!!u.audioTrack).length||0)},1000);
  void session.update();const timer=setInterval(()=>{void session.update();},20000);
  const resume=()=>{if(document.visibilityState==='visible'){unlock();void session.update();}};document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
  return()=>{dead=true;session.dead=true;clearInterval(timer);clearInterval(meter);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);sdk.current?.off('autoplay-failed',autoplay);if(current.current===session){current.current=null;local.current?.close();local.current=null;}setSpeakers([]);setSpeaking(false);if(client){client.removeAllListeners();void queue.finally(()=>client!.leave()).catch(()=>{});}};
 },[roomId,enabled]);
 useEffect(()=>{if(!enabled)return;intent.current=micOn;if(local.current&&(!micOn||!canSpeak))void local.current.setEnabled(false);void current.current?.update();},[micOn,canSpeak,enabled]);
 useEffect(()=>{playback();},[soundOn,controls]);
 return {micLevel,remoteAudioCount,connectionState,status,speakers,speaking,audioBlocked,permission,unlock,reconnect:()=>current.current?.update(),failureReason:()=>error.current||'মাইক চালু হয়নি। আবার চেষ্টা করুন।'};
}
