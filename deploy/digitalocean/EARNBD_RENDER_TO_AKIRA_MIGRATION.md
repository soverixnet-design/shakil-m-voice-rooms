# EarnBD Render → Akira DigitalOcean host (safe staged migration)

Status: **CODE PREPARED — NOT DEPLOYED / NOT CUT OVER**.
Existing Akira API (:4301), Akira PostgreSQL, LiveKit (:7880), Shakil voice staging (:4316), Render and earnbd.work remain untouched.

## Architecture
- Render currently runs `functions/render-server.js` for all EarnBD account/social/rooms, wallet, games, gifts, seller and admin APIs.
- This migration runs the same code as a **separate** container `shakilm-earnbd-api`, bound only to `127.0.0.1:4317` on DigitalOcean host `139.59.73.98`.
- The existing EarnBD Supabase project and ledger remain authoritative; **do not copy, reset, or reinitialize balances**. The Firestore→Supabase migration markers are already present.
- Nginx exposes it under `https://api.soverixnet.online/earnbd/`; existing Akira root routes keep their current upstream.
- The frontend URL parser accepts the exact new prefix, but its **default URL is still Render** until a separate validated cutover.

## Preflight (NO writes)
Check the 2 GB droplet's live RAM and running containers first; adding 512 MB capacity may be unsafe if swap is exhausted or Akira already consumes nearly all memory.
```sh
ssh root@139.59.73.98 'free -m; docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"; if test -s /etc/shakilm-secrets/earnbd-api.env; then echo EARNBD_ENV=EXISTS; else echo EARNBD_ENV=MISSING; fi'
```
DO NOT start the new service until available RAM and port 4317 have been checked.

## Secrets (server only, never send to chat)
1. Use the **existing** EarnBD Supabase project database connection string (prefer Session pooler on IPv4). Never add it to GitHub, the app, logs or chat.
2. Create `/etc/shakilm-secrets/earnbd-api.env` on DO with one line `SUPABASE_DATABASE_URL=postgresql://...`. Permissions `chmod 600`, owned by root. Do not alter Akira's DB secrets.
3. Reuse the **existing** validated Firebase service account file mounted read-only from `/etc/shakilm-secrets/firebase-service-account.json`.

## Opt-in staging deployment (only after preflight + secrets)
```sh
ssh root@139.59.73.98 'git -C /opt/shakilm-voice pull --ff-only && cd /opt/shakilm-voice && docker compose -p shakilmearnbd -f deploy/digitalocean/docker-compose.earnbd-api.yml up -d --build'
```
The sidecar has a 512 MB memory limit. `EARNBD_ENABLE_SWEEP` defaults to **false** to prevent two instances settling the same bets; Render continues the existing settlement loop during this smoke test.

Health (must show `status=ok`, `socialDatabase=supabase`, `gamesDatabase=supabase`; if not, stop before Nginx):
```sh
ssh root@139.59.73.98 'curl -fsS --max-time 20 http://127.0.0.1:4317/health'
```

## Isolated Nginx preview routing
Only when local health passes, run the checked script. It makes a timestamped Nginx backup, verifies the Akira vhost, tests Nginx syntax, reloads and restores old contents on failure.
```sh
ssh root@139.59.73.98 'python3 /opt/shakilm-voice/deploy/digitalocean/configure_earnbd_nginx.py'
```
Then verify:
```sh
curl -fsS --max-time 20 https://api.soverixnet.online/earnbd/health
curl -sS -o /dev/null -w 'AUTH=%{http_code}\n' -X POST -H 'Content-Type: application/json' --data '{}' https://api.soverixnet.online/earnbd/api/sync
```
The unauthenticated POST **must** return HTTP **401**. Check CORS preflight from `https://voice.soverixnet.online` and `https://earnbd.work` before testing an authenticated client.

## Production cutover — NOT YET AUTHORIZED BY STAGING HEALTH
1. Confirm DB, rooms, login, voice membership, wallet balances and authenticated bet round using separate test accounts.
2. First update the preview client's default `game-server-config.json` to `https://api.soverixnet.online/earnbd`; do NOT change global `system/gameServer` ahead of installed client versions.
3. Reconfigure `SHAKILM_SOCIAL_API_URL` used by voice staging from Render to `https://api.soverixnet.online/earnbd/api/social`; roll only the separate Shakil voice container after backend smoke tests.
4. Coordinate old Render background settlement shutdown and new DO `EARNBD_ENABLE_SWEEP=true` **without overlapping settlement jobs**. Do not do a blind dual-writer cutover.
5. Only after success, update live earnbd.work/Android clients and their global server setting; preserve Render for rollback until verified.

## Rollback
Until production cutover, simply keep all clients pointed at Render and do nothing further. Staging container can be stopped without affecting Akira or production. Nginx script reports the exact timestamped backup. Do not overwrite the shared Akira Nginx file without first verifying its current routes and the exact backup.
