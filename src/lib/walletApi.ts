import {doc} from 'firebase/firestore';
import {getDoc} from './reliableFirestore';
import {withTimeout} from './authTimeout';
import {db} from '../firebase';
import config from '../../game-server-config.json';
import {callSharedGame} from './gameTransport';
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
 return (await callSharedGame<any>(await resolveServerUrl(),action,data)).data;
}
