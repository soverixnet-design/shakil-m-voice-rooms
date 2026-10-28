import {doc} from 'firebase/firestore';
import {getDoc} from './reliableFirestore';
import {withTimeout} from './authTimeout';
import {db} from '../firebase';
import config from '../../game-server-config.json';
import {callSharedGame} from './gameTransport';
import {callVoiceStaging} from './voiceStagingTransport';
import {voiceStagingEnabled,roomUsesStagingVoice} from './voiceStagingPolicy';
// Share the settings read across concurrent requests; refresh without delaying warm calls.
let serverUrl=config.url, refreshedAt=0, pending:Promise<string>|null=null;
function resolveServerUrl(){
 if(Date.now()-refreshedAt<60000)return Promise.resolve(serverUrl);
 if(!pending)pending=(async()=>{
  try{const settings=await withTimeout(getDoc(doc(db,'system','gameServer')),2000);serverUrl=settings.data()?.url||config.url}catch{}
  refreshedAt=Date.now();return serverUrl;
 })().finally(()=>{pending=null});
 // Only the first request waits for settings. Existing connections keep their known endpoint.
 if(refreshedAt){void pending;return Promise.resolve(serverUrl)}
 return pending;
}
export async function walletApi(action:'sync'|'gift'|'lucky-gift'|'exchange'|'voice-config'|'referral'|'events'|'staff'|'sellers'|'devices',data:any){
 // Off by default. Only explicitly LiveKit-enabled rooms use DigitalOcean.
 // Never fall back one participant alone: it would split the room's audio.
 if(action==='voice-config'&&voiceStagingEnabled(import.meta.env.VITE_SHAKILM_VOICE_STAGING)){
  const roomId=data?.roomId;
  if(typeof roomId!=='string'||!roomId||roomId.includes('/')||roomId.length>200)
   throw Object.assign(Error('invalid-room'),{code:'functions/invalid-argument'});
  let room;
  try{room=await withTimeout(getDoc(doc(db,'rooms',roomId)),5000);}
  catch{throw Object.assign(Error('room-route-unavailable'),{code:'functions/unavailable'});}
  if(roomUsesStagingVoice(room.data()))return (await callVoiceStaging(data)).data;
 }
 return (await callSharedGame<any>(await resolveServerUrl(),action,data)).data;
}
