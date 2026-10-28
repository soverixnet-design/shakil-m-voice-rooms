# LiveKit-first voice rollout (Shakil M / EarnBD)

This branch is staging only. It must not change the live website, Android APK, Akira services, games, wallets, gifts, or Render.

## Primary voice
Agora/Tencent are metered/trial providers. Our DigitalOcean-hosted LiveKit is intended as the default. Older LIVEKIT_MINUTES_BUDGET=90 settings are no longer a LiveKit cutoff. The actual limitations are available CPU, memory, bandwidth and connectivity.

## Room-wide selection
1. room.voiceProvider = livekit: DO LiveKit, if staging voice is enabled.
2. Explicit room.voiceProvider = agora, tencent or render: existing Render voice service.
3. No voiceProvider field: Render until a coordinated LiveKit-first rollout is enabled.
4. Unassigned rooms use LiveKit only when both are set:
   - Backend environment LIVEKIT_PRIMARY_FOR_UNSET_ROOMS=true
   - Frontend test build environment VITE_SHAKILM_VOICE_STAGING=true and VITE_SHAKILM_LIVEKIT_PRIMARY=true
5. The DigitalOcean staging token service is isolated and read-only to Firestore. Game, wallet and gift requests always go to Render.
6. Do not fall back on a per-user token failure. LiveKit and Agora cannot hear each other. Changing providers requires a coordinated per-room transition for every participant.

## Safe rollout
- All live production flags stay OFF. Never auto-merge this staging branch to main.
- First deploy isolated staging only and check local /health 200 and unauthenticated /api/voice-config 401.
- Test two authenticated devices joining a room explicitly marked voiceProvider=livekit. Confirm microphone permissions, mute/unmute, seat grants, reconnect and minimized/background audio.
- Only then test a staging frontend with BOTH frontend flags and backend rollout flag switched on for rooms without a provider field. Both participants must use this same test build; mixing live legacy clients with staging clients can split the call.
- Public adoption requires a separately reviewed client/server rollout. Keep legacy services running.

## Automatic switching limitations
- LiveKit is primary in the opt-in client, so it does not wait for Agora/Tencent minutes to expire.
- Existing Render provider quota and trial dates rely on operator-supplied values, not automatic account usage checks.
- Automatic room-wide failover for a LiveKit outage and mixed-client provider migration are NOT yet implemented.
- Server health 200 does not prove that two real phones can talk; test the microphone end-to-end.

## Verification without exposing credentials
- Local: curl -fsS http://127.0.0.1:4316/health
- Health includes livekitPrimaryForUnassignedRooms; this is a boolean, not a secret.
- Public voice endpoint rejects unauthenticated POST with 401.
- Verify Akira and Render independently; do not restart their containers.
