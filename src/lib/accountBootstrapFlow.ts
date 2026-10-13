import {gameServerUrl} from './gameServerUrl';
import {withTimeout} from './authTimeout';
import {requestJson} from './resilientRequest';
export async function loadAccountProfile({getToken,request,url,onStage=()=>{},pause}:{getToken:()=>Promise<string>;request:typeof fetch;url:string;onStage?:(stage:string)=>void;pause?:(ms:number)=>Promise<void>}){
 onStage('Verifying your saved session…');
 let token:string;
 try{token=await withTimeout(getToken(),20000)}catch(e:any){throw Object.assign(Error('Saved session could not be checked. Reconnecting without signing out.'),{code:'login/session-verification-failed'})}
 onStage('Connecting to your profile server… Your sign-in is saved.');
 try{
  const result=await requestJson(`${gameServerUrl(url)}/api/account`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}'},{request,retryable:true,timeoutMs:75000,pause});
  if(!result.data?.id||typeof result.data.name!=='string')throw Object.assign(Error('The server returned an incomplete profile.'),{code:'login/invalid-profile'});
  return result.data as {id:string;name:string;photoURL:string;coins:number;role:string};
 }catch(e:any){
  if(e.name==='AbortError'||e.code==='functions/unavailable')throw Object.assign(Error('The profile server is reconnecting. Your sign-in is saved.'),{code:'login/profile-server-timeout'});
  if(e instanceof TypeError)throw Object.assign(Error('The profile server is unreachable. Your sign-in is saved.'),{code:'login/profile-server-unreachable'});
  if(e.code?.startsWith('functions/'))e.code=e.code.replace('functions/','login/');
  throw e;
 }
}
