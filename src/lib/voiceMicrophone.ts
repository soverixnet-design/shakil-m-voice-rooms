/** Start capture once, without a disable/re-enable cycle during acquisition. */
export async function captureVoiceMicrophone<T extends {close:()=>void}>(create:()=>Promise<T>,allowed:()=>boolean):Promise<T>{
 const track=await create();
 if(!allowed()){track.close();throw Error('voice-not-ready');}
 return track;
}

/** Retry capture through the browser's default audio input if SDK constraints fail. */
export async function compatibleVoiceMicrophone(sdk:any,devices:Pick<MediaDevices,'getUserMedia'>|undefined,allowed:()=>boolean,preferBrowser=false){
 try{if(preferBrowser&&devices)throw {code:'USE_BROWSER_CAPTURE'};return await captureVoiceMicrophone(()=>sdk.createMicrophoneAudioTrack({AEC:true,ANS:true,AGC:true}),allowed);}
 catch(error:any){
  const code=String(error?.code||error?.name||'');
  if(!['USE_BROWSER_CAPTURE','NOT_READABLE','NotReadableError','CONSTRAINT_NOT_SATISFIED','OverconstrainedError'].includes(code)||!devices||!allowed())throw error;
  let stream:MediaStream|undefined;
  try{
   stream=await devices.getUserMedia({audio:true,video:false});
   const audio=stream.getAudioTracks()[0];
   if(!allowed()||!audio||audio.readyState==='ended')throw Error('voice-not-ready');
   const track=sdk.createCustomAudioTrack({mediaStreamTrack:audio,encoderConfig:'speech_standard'}),close=track.close.bind(track),ownedStream=stream;
   track.close=()=>{try{close()}finally{ownedStream.getTracks().forEach(t=>t.stop())}};
   return track;
  }catch(nativeError:any){stream?.getTracks().forEach(t=>t.stop());throw Object.assign(new Error(nativeError?.message||'Microphone capture failed'),{code:typeof nativeError?.code==='string'?nativeError.code:(nativeError?.name||'CAPTURE_FAILED'),captureStage:'browser-capture'});}
 }
}
