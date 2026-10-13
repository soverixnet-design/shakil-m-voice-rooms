import config from '../../game-server-config.json';
import {auth} from '../firebase';
import {loadAccountProfile} from './accountBootstrapFlow';
import {withTimeout} from './authTimeout';
export async function accountBootstrap(onStage?:(stage:string)=>void){
  const user=auth.currentUser;if(!user)throw Object.assign(Error('Sign in again.'),{code:'login/no-session'});
  onStage?.('Verifying your Google/email session…');
  const token=await withTimeout(user.getIdToken(),8000);
  onStage?.('Loading your saved profile…');
  // Supabase is authoritative for profiles after migration; avoid old Firebase data.
  return loadAccountProfile({getToken:async()=>token,request:fetch,url:config.url,onStage});
}
