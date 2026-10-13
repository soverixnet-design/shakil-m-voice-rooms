/** Start capture once, without a disable/re-enable cycle during acquisition. */
export async function captureVoiceMicrophone<T extends {close:()=>void}>(create:()=>Promise<T>,allowed:()=>boolean):Promise<T>{
 const track=await create();
 if(!allowed()){track.close();throw Error('voice-not-ready');}
 return track;
}
