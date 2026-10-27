export async function updateVoicePublication({client,track,config,wants,allowed,alive,published}:any){
 const stop=async()=>{if(published){await client.unpublish();published=false;}if(track)await track.setEnabled(false);await client.setClientRole('audience');return {published:false,speaking:false};};
 if(!alive())return {published:false,speaking:false};
 await client.renewToken(config.token);
 if(!alive())return {published:false,speaking:false};
 if(!wants||!allowed()||!config.canPublish||!track)return stop();
 await client.setClientRole('host');
 if(!alive()||!allowed())return stop();
 await track.setEnabled(true);
 if(!alive()||!allowed())return stop();
 // Restore the synchronous safety gate only after permission is confirmed.
 const mediaTrack=track.getMediaStreamTrack?.();if(mediaTrack)mediaTrack.enabled=true;
 try{if(!published)await client.publish(track);}catch(error){await track.setEnabled(false);throw error;}
 if(!alive()||!allowed()){await track.setEnabled(false);await client.unpublish();return {published:false,speaking:false};}
 return {published:true,speaking:true};
}
export function outdatedVoiceBundle(error:any){return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(String(error?.message||''))}
export function voiceFailure(error:any){
 if(outdatedVoiceBundle(error))return 'An outdated voice file could not load. Tap Update to reload the app.';
 const code=String(error?.code||error?.name||'');
 if(code==='TRACK_IS_DISABLED')return 'The microphone track stopped. Tap Mic to start a fresh connection.';
 if(code==='CONSTRAINT_NOT_SATISFIED'||code==='OverconstrainedError')return 'The microphone audio settings could not start. Tap Mic to retry.';
 if(['PERMISSION_DENIED','NotAllowedError','SecurityError'].includes(code))return 'Microphone access is denied. Open browser Site settings → Microphone → Allow.';
 if(['DEVICE_NOT_FOUND','NotFoundError'].includes(code))return 'No phone microphone was found.';
 if(['NOT_READABLE','NotReadableError'].includes(code))return 'Audio could not be captured from the phone microphone. Check that the phone’s Microphone access is on, then retry.';
 if(code==='functions/permission-denied')return 'Your room membership or seat permission was denied. Join the room again.';
 if(error?.message==='seat-permission-required')return 'You have no microphone seat permission, or an admin muted you. Take a seat again.';
 if(error?.message==='voice-quota-exhausted')return 'The configured voice minute budget is exhausted. Ask an admin to enable another provider.';
 if(error?.message==='voice-not-configured')return 'Voice provider settings are not configured on the server.';
 if(error?.message==='agora-not-configured')return 'The Agora App ID or Certificate is missing or invalid on the server.';
 if(['INVALID_TOKEN','CAN_NOT_GET_GATEWAY_SERVER','TOKEN_EXPIRED'].includes(code))return 'The voice token was rejected. Check the provider API key, App ID and Certificate.';
 return 'Voice is not ready or the network is unavailable. Wait a few seconds and tap Mic again.';
}
