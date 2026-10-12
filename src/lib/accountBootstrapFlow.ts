import {gameServerUrl} from './gameServerUrl';
import {withTimeout} from './authTimeout';
export async function loadAccountProfile({getToken,request,url,onStage=()=>{}}:{getToken:()=>Promise<string>;request:typeof fetch;url:string;onStage?:(stage:string)=>void}){
  onStage('Verifying your Google/email session…');
  let token:string;
  try{token=await withTimeout(getToken(),8000)}catch(e:any){throw Object.assign(Error(e.code==='account-timeout'?'Google session verification timed out. Use another account, then sign in again.':`Google session verification failed (${e.code||'network-error'}).`),{code:'login/session-verification-failed'})}
  onStage('Loading your profile from the server…');
  const controller=new AbortController();
  try{
    return await withTimeout((async()=>{
      const response=await request(`${gameServerUrl(url)}/api/account`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}',signal:controller.signal});
      const result=await response.json();
      if(!response.ok||result.error)throw Object.assign(Error(result.error?.message||'server-error'),{code:`login/${result.error?.code||'server-error'}`});
      if(!result.data?.id||typeof result.data.name!=='string')throw Object.assign(Error('The server returned an incomplete profile.'),{code:'login/invalid-profile'});
      return result.data as {id:string;name:string;photoURL:string;coins:number;role:string};
    })(),20000);
  }catch(e:any){
    if(e.code==='account-timeout'||e.name==='AbortError')throw Object.assign(Error('The profile server did not respond within 20 seconds. Please retry.'),{code:'login/profile-server-timeout'});
    if(e instanceof TypeError)throw Object.assign(Error('Your browser could not reach the profile server. Check the internet connection.'),{code:'login/profile-server-unreachable'});
    throw e;
  }finally{controller.abort()}
}
