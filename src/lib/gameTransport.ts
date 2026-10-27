import {deviceHeaders} from './deviceIdentity';
import {timedGameRequest} from './timedGameRequest';
import {withTimeout} from './authTimeout';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {auth} from '../firebase';
import {gameServerUrl} from './gameServerUrl';
const functions=getFunctions(auth.app,'asia-southeast1');
export async function callSharedGame<T>(url:string,action:'sync'|'bet'|'gift'|'lucky-gift'|'exchange'|'voice-config'|'account'|'referral'|'events'|'staff'|'sellers'|'devices',data:any):Promise<{data:T;timing?:{sent:number;received:number}}>{
 if(!url&&action!=='sync'&&action!=='bet')throw Object.assign(Error('server-unavailable'),{code:'functions/unavailable'});
 if(!url)return await httpsCallable<any,T>(functions,action==='sync'?'syncSharedGame':'placeSharedBet',{timeout:30000})(data);
 const user=auth.currentUser;if(!user)throw Object.assign(Error('unauthenticated'),{code:'functions/unauthenticated'});
 const base=gameServerUrl(url),token=await withTimeout(user.getIdToken(),8000);
 return timedGameRequest(base+'/api/'+action,{method:'POST',headers:{...deviceHeaders(),'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data)},{timeoutMs:action==='bet'?10000:action==='sync'?15000:75000,retryable:['sync','voice-config'].includes(action)||['bet','gift','exchange'].includes(action)&&!!data.requestId});
}
