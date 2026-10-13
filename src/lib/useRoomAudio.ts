import {updateVoicePublication,voiceFailure} from './voicePublication';
import {withTimeout} from './authTimeout';
import {useEffect,useRef,useState} from 'react';
import type {IAgoraRTCClient,IMicrophoneAudioTrack} from 'agora-rtc-sdk-ng';
import {walletApi} from './walletApi';
export function useRoomAudio(roomId:string,micOn:boolean,soundOn:boolean,canSpeak:boolean,controls:Record<string,any>,enabled=true){
 const [status,setStatus]=useState(''),[speakers,setSpeakers]=useState<string[]>([]);
 const flags=useRef({micOn,soundOn,canSpeak,controls});flags.current={micOn,soundOn,canSpeak,controls};
 const error=useRef('');
 const local=useRef<IMicrophoneAudioTrack|null>(null),current=useRef<{client:IAgoraRTCClient;update:(force?:boolean)=>Promise<boolean>;ready:Promise<void>;dead:boolean}|null>(null);
 function playback(){for(const user of current.current?.client?.remoteUsers||[]){const off=!flags.current.soundOn||flags.current.controls[String(user.uid)]?.muted||flags.current.controls[String(user.uid)]?.blocked;user.audioTrack?.setVolume(off?0:100);if(!off)user.audioTrack?.play();}}
 function unlock(){playback();}
 async function permission(){
  if(!enabled||!flags.current.canSpeak){error.current='মাইক চালু করতে আগে সিটে বসুন।';setStatus(error.current);return false;}
  const session=current.current;error.current='';
  try{
   if(!session||session.dead)throw Error('voice-not-ready');
   if(!local.current){const {default:AgoraRTC}=await import('agora-rtc-sdk-ng');const track=await AgoraRTC.createMicrophoneAudioTrack({AEC:true,ANS:true,AGC:true});if(session.dead||current.current!==session){track.close();throw Error('voice-not-ready');}await track.setEnabled(false);local.current=track;}
   await withTimeout(session.ready,15000);
   if(session.dead||current.current!==session)throw Error('voice-not-ready');
   const success=await session.update(true);if(!success)throw Error(error.current||'voice-not-ready');
   error.current='';return true;
  }catch(e:any){if(!error.current)error.current=voiceFailure(e);setStatus(error.current);return false;}
 }
 useEffect(()=>{
  if(!enabled)return;
  let dead=false,client:IAgoraRTCClient|undefined,timer:ReturnType<typeof setInterval>|undefined,queue=Promise.resolve(),published=false;
  let resolveReady:()=>void,rejectReady:(e:any)=>void;const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});void ready.catch(()=>{});
  const session={ready,get client(){return client!},dead:false,update:(force?:boolean)=>{const task=queue.then(async()=>{await ready;return refresh(force);}).catch(async e=>{if(!dead){if(local.current)await local.current.setEnabled(false).catch(()=>{});if(client&&published){await client.unpublish().catch(()=>{});published=false;}error.current=voiceFailure(e);setStatus(error.current);}return false;});queue=task.then(()=>{});return task;}};current.current=session;error.current='';
  function audible(){if(dead||!client)return;setSpeakers(client.remoteUsers.filter(u=>u.hasAudio&&!flags.current.controls[String(u.uid)]?.muted&&!flags.current.controls[String(u.uid)]?.blocked).map(u=>String(u.uid)));playback();}
  async function refresh(force?:boolean){
   if(dead||!client)return false;
   // Disable immediately on local mute/seat removal, before network work.
   const wants=Boolean((force===true||flags.current.micOn)&&flags.current.canSpeak);
   if(local.current&&!wants)await local.current.setEnabled(false);
   let config:any;
   try{config=await walletApi('voice-config',{roomId});}catch(error){if(local.current)await local.current.setEnabled(false);if(published){await client.unpublish();published=false;}throw error;}
   if(dead)return false;
   const result=await updateVoicePublication({client,track:local.current,config,wants,allowed:()=>flags.current.canSpeak&&(force===true||flags.current.micOn),alive:()=>!dead,published});published=result.published;
   if(force===true&&!result.speaking)throw Error('seat-permission-required');
   if(!dead){error.current='';setStatus(result.speaking?'মাইক চালু হয়েছে।':'ভয়েস সংযোগ হয়েছে। মাইক বন্ধ আছে।');}audible();return force===true?result.speaking:true;
  }
  void(async()=>{
   const config=await walletApi('voice-config',{roomId});if(dead)return;
   if(config.provider!=='agora')throw Error('agora-not-configured');
   const {default:AgoraRTC}=await import('agora-rtc-sdk-ng');if(dead)return;
   AgoraRTC.setLogLevel(3);client=AgoraRTC.createClient({mode:'live',codec:'vp8'});current.current=session;
   client.on('user-published',async(user,type)=>{if(type!=='audio'||dead)return;try{await client!.subscribe(user,type);audible();}catch{if(!dead)setStatus('অন্য সদস্যের অডিও পাওয়া যায়নি।');}});
   client.on('user-unpublished',audible);client.on('user-left',audible);
   client.on('token-privilege-will-expire',()=>{void session.update();});
   client.on('token-privilege-did-expire',()=>{void session.update();});
   client.on('connection-state-change',state=>{if(!dead)setStatus(state==='CONNECTED'?'ভয়েস সংযোগ হয়েছে।':state==='RECONNECTING'?'ভয়েস আবার সংযোগ হচ্ছে…':'ভয়েস সংযোগ হচ্ছে…');});
   await client.setClientRole('audience');await client.join(config.appId,config.channel,config.token,config.uid);
   if(dead){await client.leave();rejectReady!(Error('voice-not-ready'));return;}
   resolveReady!();
   timer=setInterval(()=>{void session.update();},20000);await session.update();
  })().catch(e=>{rejectReady!(e);if(!dead){error.current=voiceFailure(e);setStatus(error.current);}});
  return()=>{dead=true;session.dead=true;rejectReady!(Error('voice-not-ready'));clearInterval(timer);if(current.current===session)current.current=null;local.current?.close();local.current=null;setSpeakers([]);if(client){client.removeAllListeners();void queue.finally(()=>client!.leave()).catch(()=>{});}};
 },[roomId,enabled]);
 useEffect(()=>{if(!enabled)return;if(local.current&&(!micOn||!canSpeak))void local.current.setEnabled(false);void current.current?.update();playback();},[micOn,canSpeak,soundOn,controls,enabled]);
 return {status,speakers,permission,unlock,failureReason:()=>error.current||'মাইক চালু হয়নি। আবার চেষ্টা করুন।'};
}
