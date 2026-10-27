# Shakil M voice-only DigitalOcean staging

This opt-in branch adds a **separate** Firebase-authorized LiveKit token API.
It does NOT run the Render game server, settlement sweeps, wallet, gifts,
account migrations, or Admin API. It reads the Shakil M Firebase users, room,
and control documents but **does not write to Firestore**. It does not affect
the existing Render service, Akira containers, or the 4315 read-only test.

## Security prerequisites

* The Firebase service account for project `gen-lang-client-0043151803`
  must be stored **only on the server** at
  `/etc/shakilm-secrets/firebase-service-account.json`, owner root, mode 600.
* Put Akira's LiveKit API key and secret in a **private server-side** file
  `/etc/shakilm-secrets/voice.env` (owner root, mode 600). Do not print
  secrets, post them to chat, or commit this env file to GitHub. The
  credentials must match the existing LiveKit server configuration.
* A correctly configured HTTPS/WebSocket public LiveKit hostname is required
  before Android clients can connect; local HTTP 200 alone does not prove
  voice, audio, UDP or TURN reachability.
* Never deploy this alongside `render-server.js` as a full game API.

Example contents for the **private** `voice.env` (fill values locally on server):

```
LIVEKIT_ENABLED=true
LIVEKIT_URL=wss://YOUR_EXISTING_LIVEKIT_TLS_HOST
LIVEKIT_API_KEY=REPLACE_LOCALLY
LIVEKIT_API_SECRET=REPLACE_LOCALLY
LIVEKIT_MINUTES_BUDGET=90
ALLOWED_ORIGINS=https://soverixnet-design.github.io,https://localhost,capacitor://localhost,http://localhost
```

## Deployment after reviewing server-specific configuration

Keep the new checkout in `/opt/shakilm-voice`, separate from
`/opt/shakilm-test` and `/opt/akira`.

```bash
cd /opt/shakilm-voice
docker compose -p shakilmvoice -f deploy/digitalocean/docker-compose.voice.yml up --build -d
curl -sS --max-time 10 http://127.0.0.1:4316/health
docker ps --filter name=shakilm-voice-only-staging
```

Expected health: `status=ok`, `mode=voice-only-staging`,
`firestoreWrites=false`.
This only proves the server process booted. Real Firebase token testing and
2 Android-client audio testing remain mandatory. Do not switch production
routing or create a release APK yet.

Staging path: `POST /api/voice-config` (Bearer Firebase ID token),
body `{"roomId":"existing-real-room-id"}`. It returns the LiveKit config
only if the authenticated user is currently in the existing room and is not
blocked; publish permission comes from the actual seat and mute state.
All other POST routes return 404, including bets and lucky gifts.
Access is limited to localhost port 4316 until HTTPS proxying is reviewed.
