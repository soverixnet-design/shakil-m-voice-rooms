#!/usr/bin/env python3
"""Run isolated Shakil M preview deployment, leaving Akira/Render/main unchanged."""
import json
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import Request, urlopen

ROOT = Path("/opt/shakilm-voice")
SCRIPTS = ROOT / "deploy" / "digitalocean"
COMPOSE = SCRIPTS / "docker-compose.voice.yml"
PREVIEW_URL = "https://voice.soverixnet.online/shakilm-preview/"
TOKEN_URL = "https://api.soverixnet.online/shakilm-voice/api/voice-config"


def execute(args, timeout):
    result = subprocess.run(args, timeout=timeout, cwd=ROOT, check=False)
    return result.returncode == 0


def main():
    for file, duration in (
        ("build_voice_preview.py", 1000),
        ("configure_preview_nginx.py", 40),
        ("enable_preview_voice.py", 30),
    ):
        print("PREVIEW_DEPLOY_STEP: " + file, flush=True)
        if not execute([sys.executable, str(SCRIPTS / file)], duration):
            print("PREVIEW_DEPLOY_STOPPED: " + file)
            return 1
    print("PREVIEW_DEPLOY_STEP: restart only voice token staging", flush=True)
    cmd = ["docker", "compose", "-p", "shakilmvoice", "-f", str(COMPOSE),
           "up", "-d", "--build", "--no-deps", "--force-recreate",
           "shakilm-voice-only-staging"]
    if not execute(cmd, 300):
        print("PREVIEW_DEPLOY_STOPPED: STAGING_CONTAINER_REBUILD_FAILED")
        return 1
    for attempt in range(9):
        try:
            with urlopen("http://127.0.0.1:4316/health", timeout=5) as response:
                state = json.load(response)
            if state.get("status") == "ok" and state.get("livekitPrimaryForUnassignedRooms") is True:
                break
        except (OSError, ValueError):
            pass
        time.sleep(2)
    else:
        print("PREVIEW_DEPLOY_STOPPED: TOKEN_SERVICE_HEALTH_NOT_READY")
        return 1
    try:
        with urlopen(PREVIEW_URL, timeout=12) as response:
            index = response.read(4096).decode("utf-8", errors="replace")
            if response.status != 200 or "EarnBD" not in index:
                raise ValueError("PREVIEW_HTML_NOT_READY")
        request = Request(
            TOKEN_URL, method="OPTIONS",
            headers={
                "Origin": "https://voice.soverixnet.online",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type,x-earnbd-device",
            },
        )
        with urlopen(request, timeout=12) as response:
            allowed = response.headers.get("Access-Control-Allow-Headers", "")
            if response.status != 204 or "x-earnbd-device" not in allowed.lower():
                raise ValueError("PREVIEW_CORS_NOT_READY")
    except (OSError, ValueError):
        print("PREVIEW_DEPLOY_STOPPED: PUBLIC_HTTP_OR_CORS_CHECK_FAILED")
        return 1
    print("LIVEKIT_PREVIEW_READY: " + PREVIEW_URL)
    print("Voice token API requires Firebase login and shared room membership.")
    print("Use two preview browsers and two distinct accounts in a dedicated test room.")
    print("Do not mix preview clients and live earnbd.work clients in one room.")
    print("Production EarnBD, Akira, Render and LiveKit WSS routes were not replaced.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
