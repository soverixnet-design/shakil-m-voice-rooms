#!/usr/bin/env python3
"""Serve the isolated Shakil M preview on the existing LiveKit HTTPS domain.

Adds only /shakilm-preview/ to the WSS vhost, preserving the RTC proxy.
Backs up Nginx and restores it on failed checks or reloads.
"""
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

NGINX_ROOT = Path("/etc/nginx")
SCAN = (NGINX_ROOT / "sites-enabled", NGINX_ROOT / "conf.d")
SITE = Path("/opt/shakilm-preview/current/index.html")
MARKER = "# Shakil M voice browser preview: static files, no API proxy"
PREFIX = "/shakilm-preview/"
LOCATION = """
    # Shakil M voice browser preview: static files, no API proxy
    location = /shakilm-preview {
        return 302 /shakilm-preview/;
    }
    location ^~ /shakilm-preview/ {
        alias /opt/shakilm-preview/current/;
        index index.html;
        try_files $uri $uri/ /shakilm-preview/index.html;
        add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
        add_header Cache-Control "no-store" always;
    }
"""


def matching_block(text):
    matches = []
    for start in re.finditer(r"(?m)^server[ \t]*\{[^\n]*$", text):
        end = re.search(r"(?m)^\}[ \t]*(?:#.*)?$", text[start.end():])
        if not end:
            raise ValueError("UNKNOWN_NGINX_LAYOUT")
        block = text[start.start():start.end() + end.end()]
        host = re.search(r"(?m)^[ \t]*server_name[ \t]+voice\.soverixnet\.online;[ \t]*$", block)
        rtc = re.search(r"proxy_pass[ \t]+http://127\.0\.0\.1:7880;", block)
        if host and rtc:
            matches.append(start.start() + host.end())
    return matches


def locate():
    candidates = []
    seen = set()
    for directory in SCAN:
        if not directory.is_dir():
            continue
        for link in directory.iterdir():
            try:
                actual = link.resolve(strict=True)
                if not actual.is_file() or not actual.is_relative_to(NGINX_ROOT) or actual in seen:
                    continue
                seen.add(actual)
                body = actual.read_text(encoding="utf-8")
                for offset in matching_block(body):
                    candidates.append((actual, body, offset))
            except (OSError, UnicodeError):
                continue
    if len(candidates) != 1:
        raise ValueError("VOICE_VHOST_NOT_UNIQUE")
    return candidates[0]


def install_atomic(path, contents):
    previous = path.stat()
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8",
                                         prefix=".shakilm-preview-nginx-",
                                         dir=path.parent, delete=False) as handle:
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


def nginx_test():
    return subprocess.run(["/usr/sbin/nginx", "-t"], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL, timeout=15).returncode == 0


def nginx_reload():
    return subprocess.run(["/usr/bin/systemctl", "reload", "nginx"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          timeout=15).returncode == 0


def main():
    if os.geteuid() != 0:
        print("PREVIEW_ROUTE_NOT_READY: ROOT_REQUIRED")
        return 1
    try:
        if not SITE.is_file():
            raise ValueError("PREVIEW_BUILD_MISSING")
        path, original, offset = locate()
        if MARKER in original:
            if "alias /opt/shakilm-preview/current/;" in original:
                print("PREVIEW_ROUTE_ALREADY_READY")
                return 0
            raise ValueError("PREVIEW_ROUTE_CONFLICT")
        if PREFIX in original:
            raise ValueError("PREVIEW_ROUTE_CONFLICT")
        if not nginx_test():
            raise ValueError("CURRENT_NGINX_INVALID")
        updated = original[:offset] + LOCATION + original[offset:]
        suffix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        backup = path.with_name(path.name + ".shakilm-preview-backup-" + suffix)
        if backup.exists():
            raise ValueError("BACKUP_CONFLICT")
        shutil.copy2(path, backup)
        try:
            install_atomic(path, updated)
            if not nginx_test() or not nginx_reload():
                raise ValueError("NGINX_TEST_OR_RELOAD_FAILED")
        except BaseException:
            install_atomic(path, original)
            nginx_test()
            nginx_reload()
            print("PREVIEW_NGINX_ROLLED_BACK")
            raise
        print("PREVIEW_ROUTE_READY: https://voice.soverixnet.online/shakilm-preview/")
        print("PREVIEW_NGINX_BACKUP: " + str(backup))
        print("Existing LiveKit WSS, Akira, and Render routes are unchanged.")
        return 0
    except ValueError as error:
        print("PREVIEW_ROUTE_NOT_READY: " + str(error))
    except (OSError, TimeoutError, subprocess.SubprocessError):
        print("PREVIEW_ROUTE_NOT_READY: FILE_OR_SERVICE_ERROR")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
