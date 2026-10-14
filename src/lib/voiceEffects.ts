export type VoiceEffect='normal'|'radio'|'warm'|'echo';
/** Process only the outgoing microphone; never route capture to the local speaker. */
export async function withVoiceEffects(sdk:any,input:any){
 const context=new AudioContext(),nodes:AudioNode[]=[];
 let output:any;
 try{
  await context.resume();
  if(context.state!=='running')throw Error('audio-context-suspended');
  const source=context.createMediaStreamSource(new MediaStream([input.getMediaStreamTrack()]));
  const filter=context.createBiquadFilter(),dry=context.createGain(),wet=context.createGain(),delay=context.createDelay(1),destination=context.createMediaStreamDestination();
  nodes.push(source,filter,dry,wet,delay,destination);
  source.connect(filter);filter.connect(dry);dry.connect(destination);filter.connect(delay);delay.connect(wet);wet.connect(destination);
  delay.delayTime.value=.18;
  output=sdk.createCustomAudioTrack({mediaStreamTrack:destination.stream.getAudioTracks()[0],encoderConfig:'speech_standard'});
  output.setVoiceEffect=(effect:VoiceEffect)=>{
   filter.type=effect==='radio'?'highpass':effect==='warm'?'lowpass':'allpass';
   filter.frequency.value=effect==='radio'?650:effect==='warm'?900:1000;filter.Q.value=.7;
   dry.gain.value=effect==='echo'?.8:1;wet.gain.value=effect==='echo'?.22:0;
  };
  output.setVoiceEffect('normal');
  const close=output.close.bind(output);let closed=false;
  output.close=()=>{if(closed)return;closed=true;try{close()}finally{nodes.forEach(n=>n.disconnect());destination.stream.getTracks().forEach(t=>t.stop());input.close();void context.close().catch(()=>{});}};
  return output;
 }catch{output?.close();nodes.forEach(n=>n.disconnect());void context.close().catch(()=>{});return input;}
}
