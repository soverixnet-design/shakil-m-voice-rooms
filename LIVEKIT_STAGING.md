# Akira-style LiveKit voice for Shakil M — staging setup

This is an optional server-authorized audio provider. The existing Shakil M app
design, Firebase sign-in, room seats, wallets, Agora and Tencent providers remain
unchanged. It is **disabled by default** and must not be enabled on Render or
production without a successful end-to-end test on separate staging clients.

## Server-only environment variables

Set these on the Shakil M API server after its Firebase credentials and room
membership checks are working. Never embed keys/secrets in the web app, APK,
GitHub commits or screenshots.

```
LIVEKIT_ENABLED=true
LIVEKIT_URL=wss://YOUR_TLS_LIVEKIT_HOST
LIVEKIT_API_KEY=YOUR_SERVER_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_SERVER_LIVEKIT_API_SECRET
LIVEKIT_MINUTES_BUDGET=90
VOICE_PROVIDER_ORDER=livekit,agora,tencent
VOICE_QUOTA_CYCLE=staging-202610
```

- `LIVEKIT_MINUTES_BUDGET` is an **operator-selected safety limit**, not a
  claim about free credits. The routing ledger reserves 1.5 participant-minutes
  per new 90-second lease; multiple real participants consume this budget.
- To test LiveKit alone, set `VOICE_PROVIDER_ORDER=livekit`. To test fallback,
  configure the existing Agora/Tencent credentials and minutes separately.
- Reusing Akira's self-hosted LiveKit service is possible if the operator owns
  it and copies its server-side LiveKit URL, API key and secret to **Shakil M's
  private server environment**. It must not call Akira's user-auth endpoints:
  Akira sessions are not Shakil M Firebase sessions.
- Shakil M rooms use `shakilm-<sha256-prefix>` and opaque Firebase UID
  identities, isolated from the `akira-` room namespace.
- LiveKit access requires an authenticated Firebase member with
  `currentRoomId` matching the room; only an unmuted, seated member receives
  microphone publish permission. Blocked and banned users are denied.
- A change in seat publication permission causes the LiveKit client to
  reconnect for a fresh token. Existing clients keep microphone off when they
  are not allowed to publish.
- The 2 GB DigitalOcean droplet already runs other services. Do not assume it
  has sufficient spare memory/CPU or a working WebSocket/TURN route. Monitor
  CPU, memory, ICE/TURN reachability and room packet loss under real devices.

## Test before any release

1. Run `npm ci --legacy-peer-deps`, `npm ci --prefix functions`, then
   `npm run test:games`, `npm run lint`, and `npm run build`.
2. Start the existing Firebase-authorized Shakil API on an isolated staging
   port with the variables above. Check its `/health` and `/api/voice-config`
   response for the **staging** room using a real signed-in Firebase ID token.
3. Connect two separate signed-in Android accounts to the same Shakil room.
   Check one speaker on a seat and one listener off a seat; test both directions,
   mute, unmute, remote volume, room minimize, lock/mute/kick, leaving a room,
   mobile data changes, and app resume. No demo identities.
4. Test that denied/muted/non-members cannot publish, and that a fresh seat
   change obtains new permissions. Repeat with simultaneous listeners.
5. Stop or exhaust the staging LiveKit quota and verify the configured backup
   provider is selected for the entire room, without splitting participants.
6. Verify no wallet, game, gifts, Firebase profile, room cover or language UI
   regresses. Only after this should a *separate* test APK be considered.

Do not merge this into main or change active Render routing until these tests
have been observed on real devices. The GitHub automated tests validate token
issuance and client builds; they cannot prove a deployed LiveKit websocket,
Android microphone permissions or network NAT/TURN connectivity.
