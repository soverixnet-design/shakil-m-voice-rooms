import {createHash,createHmac} from 'node:crypto';

const fail=(message,code='unavailable')=>Object.assign(Error(message),{code});

export function liveKitIsConfigured(env=process.env){
 return env.LIVEKIT_ENABLED==='true'&&
  /^wss:\/\/[^\s/@]+(?:\:[0-9]+)?(?:\/[^\s]*)?$/.test(env.LIVEKIT_URL||'')&&
  /^[A-Za-z0-9_-]{3,128}$/.test(env.LIVEKIT_API_KEY||'')&&
  typeof env.LIVEKIT_API_SECRET==='string'&&env.LIVEKIT_API_SECRET.length>=32;
}

// The Akira LiveKit server can be shared, but the room namespace and credentials
// are never shared with the Akira application client. The server signs every token.
export function createLiveKitVoiceConfig({env=process.env,roomId,uid,canPublish,clock=Date.now}={}){
 if(!liveKitIsConfigured(env))throw fail('voice-not-configured');
 if(typeof roomId!=='string'||!roomId||roomId.includes('/')||roomId.length>200)throw fail('invalid-request','invalid-argument');
 if(typeof uid!=='string'||!uid||uid.length>128||!/^[A-Za-z0-9_-]+$/.test(uid))throw fail('invalid-user','invalid-argument');
 const now=Math.floor(clock()/1000),lifetime=600;
 const room='shakilm-'+createHash('sha256').update(roomId).digest('hex').slice(0,48);
 const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const header=encoded({alg:'HS256',typ:'JWT'});
 const payload=encoded({iss:env.LIVEKIT_API_KEY,sub:uid,iat:now,nbf:now,exp:now+lifetime,
  video:{room,roomJoin:true,canPublish:!!canPublish,canSubscribe:true,canPublishData:false,
   ...canPublish?{canPublishSources:['microphone']}:{}}});
 const value=header+'.'+payload;
 const signature=createHmac('sha256',env.LIVEKIT_API_SECRET).update(value).digest('base64url');
 return {provider:'livekit',appId:env.LIVEKIT_API_KEY,url:env.LIVEKIT_URL,channel:room,uid,token:value+'.'+signature,
  canPublish:!!canPublish,expiresAt:(now+lifetime)*1000,renewAfterMs:20000};
}
