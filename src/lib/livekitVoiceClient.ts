import {Room,RoomEvent,Track,type RemoteAudioTrack,type RemoteParticipant} from 'livekit-client';

// Match the small voice-client interface already used by useRoomAudio. Keeping
// this adapter isolated preserves Agora/Tencent and the existing room UI.
export function createLiveKitVoiceClient(config:{url:string;token:string;uid:string}){
 let credentials=config;
 let room:Room|null=null;
 const listeners=new Map<string,Set<(...args:any[])=>void>>();
 const attached=new Map<RemoteAudioTrack,HTMLMediaElement>();
 let published:MediaStreamTrack|null=null;
 const emit=(name:string,...args:any[])=>{for(const callback of listeners.get(name)||[])callback(...args)};
 const audio=(track:RemoteAudioTrack)=>({
  setVolume:(volume:number)=>track.setVolume(Math.max(0,Math.min(100,volume))/100),
  play:()=>{
   if(!room||attached.has(track))return;
   const el=track.attach() as HTMLMediaElement;
   el.autoplay=true;el.style.display='none';el.dataset.shakilmLivekitAudio='1';
   document.body.appendChild(el);attached.set(track,el);
  }
 });
 const asRemote=(participant:RemoteParticipant)=>{
  const tracks=[...participant.audioTrackPublications.values()];
  const publication=tracks.find(pub=>pub.track&&pub.kind===Track.Kind.Audio);
  const remoteTrack=publication?.track as RemoteAudioTrack|undefined;
  return {uid:participant.identity,hasAudio:!!remoteTrack,audioTrack:remoteTrack?audio(remoteTrack):undefined};
 };
 const removeAudio=(track:RemoteAudioTrack)=>{
  const element=attached.get(track);if(element){element.remove();attached.delete(track)}
  track.detach().forEach(el=>el.remove());
 };
 const cleanup=()=>{for(const track of [...attached.keys()])removeAudio(track)};
 const client={
  provider:'livekit',
  get remoteUsers(){return room?[...room.remoteParticipants.values()].map(asRemote):[]},
  on(name:string,callback:(...args:any[])=>void){const set=listeners.get(name)||new Set();set.add(callback);listeners.set(name,set);return client},
  removeAllListeners(){listeners.clear();return client},
  setConfig(value:typeof config){credentials=value},
  async setClientRole(_role:string){/* LiveKit authorizes publishing on the server token. */},
  async renewToken(_token:string){/* Refreshed grants are applied via a reconnect before token expiry. */},
  async join(_appId:string,_channel:string,_token:string,_uid:string){
   if(room)await client.leave();
   const next=new Room({adaptiveStream:true,dynacast:true});room=next;
   next.on(RoomEvent.TrackSubscribed,(track,_publication,participant)=>{
    if(track.kind!==Track.Kind.Audio)return;
    emit('user-published',asRemote(participant),'audio');
   });
   next.on(RoomEvent.TrackUnsubscribed,(track)=>{
    if(track.kind===Track.Kind.Audio)removeAudio(track as RemoteAudioTrack);
    emit('user-unpublished');
   });
   next.on(RoomEvent.ParticipantDisconnected,()=>emit('user-left'));
   next.on(RoomEvent.ConnectionStateChanged,state=>{
    const mapped=String(state).toUpperCase();emit('connection-state-change',mapped);
   });
   next.on(RoomEvent.AudioPlaybackStatusChanged,()=>{
    if(!next.canPlaybackAudio)emit('autoplay-failed');
   });
   next.on(RoomEvent.Disconnected,()=>{cleanup();emit('connection-state-change','DISCONNECTED')});
   try{await next.connect(credentials.url,credentials.token,{autoSubscribe:true});
    for(const user of client.remoteUsers)if(user.hasAudio)user.audioTrack?.play();
   }catch(error){await client.leave();throw error}
   return credentials.uid;
  },
  async subscribe(user:{audioTrack?:{play:()=>void}},type:string){if(type==='audio')user.audioTrack?.play()},
  async publish(track:{getMediaStreamTrack:()=>MediaStreamTrack}){
   if(!room)throw Error('voice-not-ready');
   if(published)return;
   const native=track.getMediaStreamTrack();
   if(native.readyState!=='live')throw Error('TRACK_IS_DISABLED');
   await room.localParticipant.publishTrack(native,{source:Track.Source.Microphone});
   published=native;
  },
  async unpublish(){
   if(!room||!published)return;
   const native=published;published=null;
   await room.localParticipant.unpublishTrack(native);
  },
  async unlock(){await room?.startAudio()},
  async leave(){
   try{await client.unpublish()}finally{
    const previous=room;room=null;published=null;
    previous?.removeAllListeners();await previous?.disconnect();cleanup();
   }
  }
 };
 return client;
}
