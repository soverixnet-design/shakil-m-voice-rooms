import {getFunctions,httpsCallable} from 'firebase/functions';
import {auth} from '../firebase';
import {gameServerUrl} from './gameServerUrl';
const functions=getFunctions(auth.app,'asia-southeast1');
export async function callSharedGame<T>(url:string,action:'sync'|'bet',data:any):Promise<{data:T}>{
 if(!url)return await httpsCallable<any,T>(functions,action==='sync'?'syncSharedGame':'placeSharedBet',{timeout:30000})(data);
 const user=auth.currentUser;if(!user)throw Object.assign(Error('unauthenticated'),{code:'functions/unauthenticated'});
 const base=gameServerUrl(url),token=await user.getIdToken(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),75000);
 try{const response=await fetch(`${base}/api/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data),signal:controller.signal});let result;try{result=await response.json()}catch{throw Object.assign(Error('server-unavailable'),{code:'functions/unavailable'})}if(!response.ok||result.error)throw Object.assign(Error(result.error?.message||'server-error'),{code:`functions/${result.error?.code||'unavailable'}`});return result;}finally{clearTimeout(timer)}
}
