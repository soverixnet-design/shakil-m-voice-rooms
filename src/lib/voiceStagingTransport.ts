import {auth} from '../firebase';
import {withTimeout} from './authTimeout';
import {deviceHeaders} from './deviceIdentity';
import {timedGameRequest} from './timedGameRequest';
import {VOICE_STAGING_ENDPOINT} from './voiceStagingPolicy';

// Separate Firebase-authorized voice API. Never send wallet, game or gift actions here.
export async function callVoiceStaging(data:{roomId:string}){
 const roomId=data?.roomId;
 if(typeof roomId!=='string'||!roomId||roomId.length>200||roomId.includes('/'))
  throw Object.assign(Error('invalid-room'),{code:'functions/invalid-argument'});
 const user=auth.currentUser;
 if(!user)throw Object.assign(Error('unauthenticated'),{code:'functions/unauthenticated'});
 const token=await withTimeout(user.getIdToken(),8000);
 return timedGameRequest(VOICE_STAGING_ENDPOINT,{
  method:'POST',
  headers:{...deviceHeaders(),'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({roomId})
 },{timeoutMs:15000,retryable:true});
}
