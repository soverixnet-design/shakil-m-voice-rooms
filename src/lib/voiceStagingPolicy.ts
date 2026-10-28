// This test switch affects ONLY voice-token requests; games and wallets stay on Render.
export const VOICE_STAGING_ENDPOINT='https://api.soverixnet.online/shakilm-voice/api/voice-config';
export function voiceStagingEnabled(flag:string|undefined):boolean{
 return flag==='true';
}
// All users of a room must select the same voice provider; per-user failover
// would split conversations across incompatible LiveKit and Agora networks.
export function roomUsesStagingVoice(room:unknown):boolean{
 return !!room&&typeof room==='object'&&(room as {voiceProvider?:unknown}).voiceProvider==='livekit';
}
