/** TURN relay is relevant only to the direct WebRTC transport. Managed SDKs route media themselves. */
export function isDirectVoiceRelayMissing(health:{voiceProvider?:string;voiceRelayConfigured?:boolean}){
 return health.voiceProvider==='webrtc'&&health.voiceRelayConfigured===false;
}
