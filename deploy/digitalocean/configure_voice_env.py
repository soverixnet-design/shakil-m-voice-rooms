#!/usr/bin/env python3
"""Configure the isolated Shakil M voice API from Akira's existing LiveKit YAML.

Reads credentials locally on the DigitalOcean server; never prints or uploads
them. Does not modify Akira's YAML, Nginx, containers, or application data.
"""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit

LIVEKIT_YAML = Path("/opt/akira-livekit/livekit.yaml")
FIREBASE_JSON = Path("/etc/shakilm-secrets/firebase-service-account.json")
ENV_FILE = Path("/etc/shakilm-secrets/voice.env")
EXPECTED_PROJECT = "gen-lang-client-0043151803"
ORIGINS = "https://soverixnet-design.github.io,https://localhost,capacitor://localhost,http://localhost"


def read_one_livekit_key(path):
    in_keys = False
    pairs = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not in_keys:
            if re.fullmatch(r"keys:\s*(?:#.*)?", line):
                in_keys = True
            continue
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            break
        match = re.fullmatch(
            r"\s+([A-Za-z0-9_-]{3,128}):\s*([A-Za-z0-9_+/=-]{32,256})\s*(?:#.*)?",
            line,
        )
        if not match:
            raise ValueError("Unexpected LiveKit key syntax; cannot safely configure")
        pairs.append(match.groups())
    if len(pairs) != 1:
        raise ValueError("Exactly one supported LiveKit API key is required")
    return pairs[0]


def validate_url(value):
    parts = urlsplit(value)
    if (
        parts.scheme != "wss"
        or not parts.hostname
        or "." not in parts.hostname
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
        or any(c.isspace() for c in value)
    ):
        raise ValueError("Provide the existing public TLS WebSocket URL (wss://host)")
    return value


def main():
    parser = argparse.ArgumentParser(description="Create a private, voice-only staging env")
    parser.add_argument("--url", required=True, help="Existing public LiveKit wss:// URL")
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error("Run as root on the DigitalOcean server")
    try:
        url = validate_url(args.url)
        firebase = json.loads(FIREBASE_JSON.read_text(encoding="utf-8"))
        if firebase.get("project_id") != EXPECTED_PROJECT:
            raise ValueError("Firebase project ID mismatch")
        api_key, api_secret = read_one_livekit_key(LIVEKIT_YAML)
        if ENV_FILE.exists() or ENV_FILE.is_symlink():
            raise ValueError("voice.env already exists; refusing to overwrite")
        lines = [
            "LIVEKIT_ENABLED=true",
            "LIVEKIT_URL=" + url,
            "LIVEKIT_API_KEY=" + api_key,
            "LIVEKIT_API_SECRET=" + api_secret,
            "LIVEKIT_MINUTES_BUDGET=90",
            "ALLOWED_ORIGINS=" + ORIGINS,
        ]
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", prefix=".voice.env-",
                dir=ENV_FILE.parent, delete=False
            ) as handle:
                temporary = Path(handle.name)
                os.fchmod(handle.fileno(), 0o600)
                handle.write("\n".join(lines) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.link(temporary, ENV_FILE)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        print("VOICE_ENV_READY mode=600 firebase_project=matched livekit_keys=1")
        print("Credentials were not displayed; Akira and Render were not changed.")
    except (ValueError, OSError, json.JSONDecodeError) as error:
        # Never include secret file contents or exception values in output.
        print("VOICE_ENV_NOT_CREATED: check Firebase, LiveKit YAML and URL prerequisites")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
