import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_STAGING_ENDPOINT,voiceStagingEnabled,roomUsesStagingVoice} from '../src/lib/voiceStagingPolicy.ts';

test('LiveKit is disabled by default and requires a test build flag and room-wide selection',()=>{
 assert.equal(voiceStagingEnabled(undefined),false);
 assert.equal(voiceStagingEnabled('false'),false);
 assert.equal(voiceStagingEnabled('true'),true);
 assert.equal(roomUsesStagingVoice({voiceProvider:'livekit'}),true);
 assert.equal(roomUsesStagingVoice({voiceProvider:'agora'}),false);
 assert.equal(roomUsesStagingVoice({}),false);
 assert.equal(roomUsesStagingVoice(null),false);
 assert.equal(VOICE_STAGING_ENDPOINT,'https://api.soverixnet.online/shakilm-voice/api/voice-config');
});

test('one room uses a single provider: Render by default, LiveKit only when the room is flagged',()=>{
 for(const flag of [undefined,'false','true']){
  for(const provider of [undefined,'agora','tencent','livekit']){
   const route=voiceStagingEnabled(flag)&&roomUsesStagingVoice({voiceProvider:provider});
   assert.equal(route,flag==='true'&&provider==='livekit');
  }
 }
});
