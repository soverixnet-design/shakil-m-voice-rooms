import config from '../../game-server-config.json';
import {auth} from '../firebase';
import {loadAccountProfile} from './accountBootstrapFlow';
export async function accountBootstrap(onStage?:(stage:string)=>void){
  const user=auth.currentUser;if(!user)throw Object.assign(Error('Sign in again.'),{code:'login/no-session'});
  return loadAccountProfile({getToken:()=>user.getIdToken(),request:fetch,url:config.url,onStage});
}
