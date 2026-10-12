import config from '../../game-server-config.json';
import firebaseConfig from '../../firebase-applet-config.json';
import {auth} from '../firebase';
import {loadAccountProfile} from './accountBootstrapFlow';
import {readExistingAccount} from './existingAccount';
import {withTimeout} from './authTimeout';
export async function accountBootstrap(onStage?:(stage:string)=>void){
  const user=auth.currentUser;if(!user)throw Object.assign(Error('Sign in again.'),{code:'login/no-session'});
  onStage?.('Verifying your Google/email session…');
  const token=await withTimeout(user.getIdToken(),8000);
  onStage?.('Loading your saved Firebase profile…');
  let directError:any;
  try{
    const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents/users/${encodeURIComponent(user.uid)}`;
    const profile=await readExistingAccount({request:fetch,url,token,isOwner:user.emailVerified&&user.email?.toLowerCase()==='yfastvpn@gmail.com'});
    if(profile)return profile;
  }catch(e:any){if(e.message==='inactive-user')throw e;directError=e;}
  try{return await loadAccountProfile({getToken:async()=>token,request:fetch,url:config.url,onStage});}
  catch(e:any){if(directError)throw Object.assign(Error(`Firebase profile: ${directError.code||directError.message}; server: ${e.code||e.message}.`),{code:'login/profile-connections-failed'});throw e;}
}
