// This test switch affects ONLY voice-token requests; game and wallet URLs stay on Render.
export const VOICE_STAGING_ENDPOINT='https://api.soverixnet.online/shakilm-voice/api/voice-config';
export function voiceStagingEnabled(flag:string|undefined):boolean{
 return flag==='true';
}
export function voiceStagingMayFallback(error:unknown):boolean{
 const item=error as {code?:string;name?:string}|null;
 const code=item?.code||'';
 return ['functions/unavailable','functions/voice-backend-unavailable','functions/auth-timeout','functions/voice-not-configured'].includes(code)||
  item?.name==='TypeError'||item?.name==='AbortError';
}
