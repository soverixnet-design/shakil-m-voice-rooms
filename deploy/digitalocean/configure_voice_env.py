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


def parse_yaml_scalar(raw):
    """Parse a plain or quoted scalar without executing YAML tags or commands."""
    value = raw.strip()
    if not value:
        raise ValueError("Unsupported LiveKit key format")
    if value.startswith('"'):
        try:
            parsed, end = json.JSONDecoder().raw_decode(value)
        except json.JSONDecodeError:
            raise ValueError("Unsupported LiveKit key format") from None
        if value[end:].strip() and not value[end:].strip().startswith("#"):
            raise ValueError("Unsupported LiveKit key format")
        value = parsed
    elif value.startswith("'"):
        quoted = re.match(r"^'((?:[^']|'')*)'(?=\s|$)", value)
        if not quoted:
            raise ValueError("Unsupported LiveKit key format")
        if value[quoted.end():].strip() and not value[quoted.end():].strip().startswith("#"):
            raise ValueError("Unsupported LiveKit key format")
        value = quoted.group(1).replace("''", "'")
    else:
        value = value.split(" #", 1)[0].strip()
    if not isinstance(value, str):
        raise ValueError("Unsupported LiveKit key format")
    return value


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
        mapping = re.fullmatch(r"\s+([^:]+):\s*(.*?)\s*", line)
        if not mapping:
            raise ValueError("Unsupported LiveKit key format")
        key = parse_yaml_scalar(mapping.group(1))
        secret = parse_yaml_scalar(mapping.group(2))
        if not re.fullmatch(r"[A-Za-z0-9_-]{3,128}", key):
            raise ValueError("Unsupported LiveKit key format")
        if len(secret) < 32 or len(secret) > 256:
            raise ValueError("LiveKit secret length unsupported")
        # Docker Compose env files interpolate '$'; never write values whose
        # encoding could change or inject additional environment variables.
        unsafe = {"$", "#", chr(96), chr(39), chr(34), chr(92), ";"}
        if any(ord(c) < 33 or ord(c) > 126 or c in unsafe for c in secret):
            raise ValueError("LiveKit secret characters unsupported")
        pairs.append((key, secret))
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
    except ValueError as error:
        safe_reasons = {
            "Unsupported LiveKit key format",
            "LiveKit secret length unsupported",
            "LiveKit secret characters unsupported",
            "Exactly one supported LiveKit API key is required",
            "Firebase project ID mismatch",
            "voice.env already exists; refusing to overwrite",
            "Provide the existing public TLS WebSocket URL (wss://host)",
        }
        reason = str(error) if str(error) in safe_reasons else "Invalid config prerequisites"
        print("VOICE_ENV_NOT_CREATED: " + reason)
        raise SystemExit(1) from None
    except OSError:
        print("VOICE_ENV_NOT_CREATED: Missing or unreadable configuration file")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
