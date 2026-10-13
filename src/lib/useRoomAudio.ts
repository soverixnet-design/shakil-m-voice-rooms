import {useEffect,useRef,useState} from 'react';
import type {IAgoraRTCClient,IMicrophoneAudioTrack} from 'agora-rtc-sdk-ng';
import {walletApi} from './walletApi';
export function useRoomAudio(roomId:string,micOn:boolean,soundOn:boolean,canSpeak:boolean,controls:Record<string,any>,enabled=true){
 const [status,setStatus]=useState(''),[speakers,setSpeakers]=useState<string[]>([]);
 const flags=useRef({micOn,soundOn,canSpeak,controls});flags.current={micOn,soundOn,canSpeak,controls};
 const local=useRef<IMicrophoneAudioTrack|null>(null),current=useRef<{client:IAgoraRTCClient;update:()=>Promise<void>;dead:boolean}|null>(null);
 function playback(){for(const user of current.current?.client.remoteUsers||[]){const off=!flags.current.soundOn||flags.current.controls[String(user.uid)]?.muted||flags.current.controls[String(user.uid)]?.blocked;user.audioTrack?.setVolume(off?0:100);if(!off)user.audioTrack?.play();}}
 function unlock(){playback();}
 async function permission(){
  if(!enabled||!flags.current.canSpeak)return false;
  const session=current.current;
  try{
   if(!local.current){const {default:AgoraRTC}=await import('agora-rtc-sdk-ng');const track=await AgoraRTC.createMicrophoneAudioTrack({AEC:true,ANS:true,AGC:true});if(!session||session.dead||current.current!==session){track.close();return false;}await track.setEnabled(false);local.current=track;}
   return true;
  }catch(e:any){setStatus(e.code==='PERMISSION_DENIED'?'মাইক্রোফোনের অনুমতি দিন।':'মাইক্রোফোন চালু হয়নি। আবার চেষ্টা করুন।');return false;}
 }
 useEffect(()=>{
  if(!enabled)return;
  let dead=false,client:IAgoraRTCClient|undefined,timer:ReturnType<typeof setInterval>|undefined,queue=Promise.resolve(),published=false;
  const session={get client(){return client!},dead:false,update:()=>{queue=queue.then(refresh).catch(()=>{if(!dead)setStatus('ভয়েস সংযোগ ব্যর্থ। রুম আবার খুলুন।');});return queue;}};
  function audible(){if(dead||!client)return;setSpeakers(client.remoteUsers.filter(u=>u.hasAudio&&!flags.current.controls[String(u.uid)]?.muted&&!flags.current.controls[String(u.uid)]?.blocked).map(u=>String(u.uid)));playback();}
  async function refresh(){
   if(dead||!client)return;
   // Disable immediately on local mute/seat removal, before network work.
   const wants=flags.current.micOn&&flags.current.canSpeak;
   if(local.current&&!wants)await local.current.setEnabled(false);
   let config:any;
   try{config=await walletApi('voice-config',{roomId});}catch(error){if(local.current)await local.current.setEnabled(false);if(published){await client.unpublish();published=false;}throw error;}
   if(dead)return;
   await client.renewToken(config.token);
   const speaking=wants&&config.canPublish&&!!local.current;
   if(!speaking){if(local.current)await local.current.setEnabled(false);if(published){await client.unpublish();published=false;}await client.setClientRole('audience');}
   else{await client.setClientRole('host');await local.current!.setEnabled(true);if(!published){await client.publish(local.current!);published=true;}}
   if(!dead)setStatus('ভয়েস সংযোগ হয়েছে।');audible();
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
   if(dead){await client.leave();return;}
   timer=setInterval(()=>{void session.update();},20000);await session.update();
  })().catch(()=>{if(!dead)setStatus('ভয়েস চালু হয়নি। সার্ভারের Agora সেটিংস পরীক্ষা করুন।');});
  return()=>{dead=true;session.dead=true;clearInterval(timer);if(current.current===session)current.current=null;local.current?.close();local.current=null;setSpeakers([]);if(client){client.removeAllListeners();void queue.finally(()=>client!.leave()).catch(()=>{});}};
 },[roomId,enabled]);
 useEffect(()=>{if(!enabled)return;if(local.current&&(!micOn||!canSpeak))void local.current.setEnabled(false);void current.current?.update();playback();},[micOn,canSpeak,soundOn,controls,enabled]);
 return {status,speakers,permission,unlock};
}
