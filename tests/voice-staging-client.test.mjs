import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_STAGING_ENDPOINT,voiceStagingEnabled,voiceStagingMayFallback} from '../src/lib/voiceStagingPolicy.ts';

test('voice staging is disabled by default and requires an explicit test flag',()=>{
 assert.equal(voiceStagingEnabled(undefined),false);
 assert.equal(voiceStagingEnabled('false'),false);
 assert.equal(voiceStagingEnabled('true'),true);
 assert.equal(VOICE_STAGING_ENDPOINT,'https://api.soverixnet.online/shakilm-voice/api/voice-config');
});

test('authorization and room errors never bypass staging permissions through fallback',()=>{
 for(const code of ['functions/unauthenticated','functions/permission-denied','functions/invalid-argument','functions/rate-limited'])
  assert.equal(voiceStagingMayFallback({code}),false,code);
});

test('only unavailable services and transport failures may fall back to the original Render voice service',()=>{
 for(const code of ['functions/unavailable','functions/voice-backend-unavailable','functions/auth-timeout','functions/voice-not-configured'])
  assert.equal(voiceStagingMayFallback({code}),true,code);
 assert.equal(voiceStagingMayFallback({name:'TypeError'}),true);
 assert.equal(voiceStagingMayFallback({name:'AbortError'}),true);
 assert.equal(voiceStagingMayFallback({name:'OtherError'}),false);
});
