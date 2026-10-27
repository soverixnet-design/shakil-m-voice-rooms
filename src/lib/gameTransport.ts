import {deviceHeaders} from './deviceIdentity';
import {timedGameRequest} from './timedGameRequest';
import {withTimeout} from './authTimeout';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {auth} from '../firebase';
import serverConfig from '../../game-server-config.json';
import {selectGameServer,markGameServerFailed,isBackendUnavailable} from './serverFailover';
const functions=getFunctions(auth.app,'asia-southeast1');
export async function callSharedGame<T>(url:string,action:'sync'|'bet'|'gift'|'exchange'|'voice-config'|'account'|'referral'|'events'|'staff'|'sellers'|'devices',data:any):Promise<{data:T;timing?:{sent:number;received:number}}>{
 if(!url&&action!=='sync'&&action!=='bet')throw Object.assign(Error('server-unavailable'),{code:'functions/unavailable'});
 if(!url)return await httpsCallable<any,T>(functions,action==='sync'?'syncSharedGame':'placeSharedBet',{timeout:30000})(data);
 const user=auth.currentUser;if(!user)throw Object.assign(Error('unauthenticated'),{code:'functions/unauthenticated'});
 const backup=serverConfig.backupUrl||'';
 const base=await selectGameServer(url,backup),token=await withTimeout(user.getIdToken(),8000);
 const options={method:'POST',headers:{...deviceHeaders(),'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data)};
 const settings={timeoutMs:action==='bet'?10000:action==='sync'?15000:75000,retryable:['sync','voice-config'].includes(action)||['bet','gift','exchange'].includes(action)&&!!data.requestId};
 const call=(origin:string)=>timedGameRequest(origin+'/api/'+action,options,settings);
 try{return await call(base)}
 catch(error:any){
  if(!backup||!isBackendUnavailable(error))throw error;
  markGameServerFailed(base);
  // Only reads/idempotent operations may be replayed after an uncertain failure.
  const safe=['sync','voice-config','account'].includes(action)||['bet','gift','exchange'].includes(action)&&typeof data?.requestId==='string'&&data.requestId.length>=16;
  if(!safe)throw error;
  const next=await selectGameServer(url,backup);
  if(next===base)throw error;
  return call(next);
 }
}
