#!/usr/bin/env python3
"""Add one exact Shakil M voice proxy route to the existing Akira API vhost.

Fail closed on ambiguous Nginx layouts. Keep a timestamped backup, validate
Nginx before reload, and restore the old configuration on failure.
Never touches Akira's API process, LiveKit keys, Render, or application data.
"""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from urllib.request import urlopen

LINK = Path("/etc/nginx/sites-enabled/akira-api")
MARKER = "# Shakil M voice-only API: exact route, isolated from Akira"
ROUTE = "/shakilm-voice/api/voice-config"
UPSTREAM = "http://127.0.0.1:4316/api/voice-config"
LOCATION = """
    # Shakil M voice-only API: exact route, isolated from Akira
    location = /shakilm-voice/api/voice-config {
        client_max_body_size 8k;
        proxy_pass http://127.0.0.1:4316/api/voice-config;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 3s;
        proxy_read_timeout 20s;
        proxy_send_timeout 20s;
    }
"""


def candidate_config(text):
    if MARKER in text:
        if ROUTE in text and UPSTREAM in text:
            return None
        raise ValueError("EXISTING_ROUTE_MISMATCH")
    if ROUTE in text:
        raise ValueError("ROUTE_CONFLICT")
    candidates = []
    for start in re.finditer(r"(?m)^server[ \t]*\{[^\n]*$", text):
        end = re.search(r"(?m)^\}[ \t]*(?:#.*)?$", text[start.end():])
        if not end:
            raise ValueError("NGINX_SERVER_BLOCK_UNRECOGNIZED")
        block = text[start.start():start.end() + end.end()]
        name = re.search(
            r"(?m)^[ \t]*server_name[ \t]+api\.soverixnet\.online;[ \t]*$",
            block,
        )
        upstream = re.search(r"proxy_pass[ \t]+http://127\.0\.0\.1:4301;", block)
        if name and upstream:
            candidates.append(start.start() + name.end())
    if len(candidates) != 1:
        raise ValueError("AKIRA_VHOST_AMBIGUOUS")
    offset = candidates[0]
    return text[:offset] + LOCATION + text[offset:]


def install_atomic(path, contents):
    temporary = None
    previous = path.stat()
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", prefix=".akira-api-voice-",
            dir=path.parent, delete=False,
        ) as handle:
            temporary = Path(handle.name)
            os.fchmod(handle.fileno(), previous.st_mode & 0o777)
            os.fchown(handle.fileno(), previous.st_uid, previous.st_gid)
            handle.write(contents)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def nginx_ok():
    return subprocess.run(
        ["/usr/sbin/nginx", "-t"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        timeout=15, check=False,
    ).returncode == 0


def reload_nginx():
    return subprocess.run(
        ["/usr/bin/systemctl", "reload", "nginx"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        timeout=15, check=False,
    ).returncode == 0


def main():
    if os.geteuid() != 0:
        print("NGINX_NOT_UPDATED: ROOT_REQUIRED")
        return 1
    try:
        target = LINK.resolve(strict=True)
        if not target.is_file() or not target.is_relative_to("/etc/nginx"):
            raise ValueError("UNEXPECTED_CONFIG_PATH")
        health = json.load(urlopen("http://127.0.0.1:4316/health", timeout=4))
        if health.get("mode") != "voice-only-staging" or health.get("firestoreWrites") is not False:
            raise ValueError("VOICE_STAGING_NOT_READY")
        original = target.read_text(encoding="utf-8")
        updated = candidate_config(original)
        if updated is None:
            print("NGINX_ROUTE_ALREADY_PRESENT")
            return 0
        if not nginx_ok():
            raise ValueError("EXISTING_NGINX_CONFIG_INVALID")
        suffix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        backup = target.with_name(target.name + ".shakilm-voice-backup-" + suffix)
        if backup.exists():
            raise ValueError("BACKUP_NAME_CONFLICT")
        shutil.copy2(target, backup)
        try:
            install_atomic(target, updated)
            if not nginx_ok() or not reload_nginx():
                raise ValueError("NGINX_CHECK_OR_RELOAD_FAILED")
        except BaseException:
            install_atomic(target, original)
            # Best effort: old configuration was already valid.
            nginx_ok()
            reload_nginx()
            print("NGINX_ROLLED_BACK: original configuration restored")
            raise
        print("NGINX_VOICE_ROUTE_READY: " + ROUTE)
        print("NGINX_BACKUP: " + str(backup))
        print("Akira API fallback and other location routes remain unchanged.")
        return 0
    except ValueError as error:
        allowed = {
            "UNEXPECTED_CONFIG_PATH", "VOICE_STAGING_NOT_READY",
            "EXISTING_ROUTE_MISMATCH", "ROUTE_CONFLICT",
            "NGINX_SERVER_BLOCK_UNRECOGNIZED", "AKIRA_VHOST_AMBIGUOUS",
            "EXISTING_NGINX_CONFIG_INVALID", "BACKUP_NAME_CONFLICT",
            "NGINX_CHECK_OR_RELOAD_FAILED",
        }
        print("NGINX_NOT_UPDATED: " + (str(error) if str(error) in allowed else "CHECK_FAILED"))
        return 1
    except (OSError, TimeoutError):
        print("NGINX_NOT_UPDATED: FILE_OR_SERVICE_ERROR")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
