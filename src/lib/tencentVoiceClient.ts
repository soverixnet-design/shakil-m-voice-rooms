import TRTC from 'trtc-sdk-v5';
/** Compatibility surface keeps publication/seat safety gates common to both SDKs. */
export function createTencentVoiceClient(initial:any){
 const trtc=TRTC.create(),listeners=new Map<string,Function[]>(),users=new Map<string,any>();
 let config=initial,joined=false,currentRole='audience',permissionKey='';
 const emit=(event:string,...args:any[])=>{for(const fn of listeners.get(event)||[])fn(...args)};
 const remote=(uid:string)=>{if(!users.has(uid))users.set(uid,{uid,hasAudio:false});return users.get(uid)};
 trtc.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE,({userId})=>{const user=remote(userId);user.hasAudio=true;emit('user-published',user,'audio')});
 trtc.on(TRTC.EVENT.REMOTE_AUDIO_UNAVAILABLE,({userId})=>{const user=remote(userId);user.hasAudio=false;user.audioTrack=undefined;emit('user-unpublished',user,'audio')});
 trtc.on(TRTC.EVENT.REMOTE_USER_EXIT,({userId})=>{users.delete(userId);emit('user-left')});
 trtc.on(TRTC.EVENT.CONNECTION_STATE_CHANGED,({state})=>emit('connection-state-change',state));
 trtc.on(TRTC.EVENT.ERROR,error=>emit('voice-error',error));
 trtc.on(TRTC.EVENT.AUTOPLAY_FAILED,({resume})=>{resumeCallbacks.add(resume);emit('autoplay-failed')});
 const resumeCallbacks=new Set<()=>Promise<void>>();
 const client={provider:'tencent',get remoteUsers(){return [...users.values()]},
  on(event:string,fn:Function){listeners.set(event,[...(listeners.get(event)||[]),fn])},
  removeAllListeners(){listeners.clear()},
  async join(){await trtc.enterRoom({sdkAppId:config.appId,userId:config.uid,userSig:config.token,strRoomId:config.channel,scene:TRTC.TYPE.SCENE_LIVE,role:TRTC.TYPE.ROLE_AUDIENCE,privateMapKey:config.privateMapKey,autoReceiveAudio:true});joined=true},
  async leave(){try{if(joined)await trtc.exitRoom()}finally{joined=false;trtc.destroy();users.clear()}},
  async renewToken(_token:string){},
  setConfig(next:any){config=next},
  async setClientRole(role:string){if(!joined||currentRole===role&&permissionKey===config.privateMapKey)return;await trtc.switchRole(role==='host'?TRTC.TYPE.ROLE_ANCHOR:TRTC.TYPE.ROLE_AUDIENCE,{privateMapKey:config.privateMapKey});currentRole=role;permissionKey=config.privateMapKey},
  async publish(track:any){await trtc.startLocalAudio({option:{audioTrack:track.getMediaStreamTrack()}})},
  async unpublish(){await trtc.stopLocalAudio()},
  async subscribe(user:any){user.audioTrack={setVolume:(volume:number)=>trtc.setRemoteAudioVolume(String(user.uid),volume),play:()=>{void trtc.muteRemoteAudio(String(user.uid),false).catch(()=>{})}}},
  async unlock(){await Promise.all([...resumeCallbacks].map(fn=>fn()));resumeCallbacks.clear()},
 };
 return client;
}
