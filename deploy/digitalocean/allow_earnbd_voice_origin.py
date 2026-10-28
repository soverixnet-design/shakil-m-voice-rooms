#!/usr/bin/env python3
"""Allow the existing EarnBD web-app origin on Shakil M's isolated voice API.

The secret values never leave the server or appear in diagnostic output.
Only ALLOWED_ORIGINS is changed; Akira, Render and Firebase data are untouched.
"""
import os
from pathlib import Path
import stat
import tempfile

ENV_FILE = Path("/etc/shakilm-secrets/voice.env")
REQUIRED = ("https://earnbd.work", "https://www.earnbd.work")


def add_origins(source):
    rows = source.splitlines()
    matches = [i for i, row in enumerate(rows) if row.startswith("ALLOWED_ORIGINS=")]
    if len(matches) != 1:
        raise ValueError("ORIGIN_SETTING_MISSING_OR_AMBIGUOUS")
    index = matches[0]
    old = [v.strip() for v in rows[index].split("=", 1)[1].split(",") if v.strip()]
    for entry in REQUIRED:
        if entry not in old:
            old.append(entry)
    rows[index] = "ALLOWED_ORIGINS=" + ",".join(old)
    return "\n".join(rows) + "\n"


def main():
    if os.geteuid() != 0:
        print("VOICE_ORIGINS_NOT_UPDATED: ROOT_REQUIRED")
        return 1
    try:
        if ENV_FILE.is_symlink():
            raise ValueError("SECRET_FILE_SYMLINK_NOT_ALLOWED")
        current = ENV_FILE.stat()
        if stat.S_IMODE(current.st_mode) != 0o600:
            raise ValueError("SECRET_FILE_PERMISSIONS_NOT_600")
        original = ENV_FILE.read_text(encoding="utf-8")
        updated = add_origins(original)
        if updated == original:
            print("VOICE_ORIGINS_ALREADY_READY")
            return 0
        temp = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", prefix=".voice-env-origin-",
                dir=ENV_FILE.parent, delete=False,
            ) as output:
                temp = Path(output.name)
                os.fchmod(output.fileno(), 0o600)
                os.fchown(output.fileno(), current.st_uid, current.st_gid)
                output.write(updated)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temp, ENV_FILE)
        finally:
            if temp is not None:
                temp.unlink(missing_ok=True)
        print("VOICE_ORIGINS_READY: earnbd.work and www.earnbd.work")
        print("No credentials were displayed or changed.")
        return 0
    except ValueError as error:
        allowed = {
            "ORIGIN_SETTING_MISSING_OR_AMBIGUOUS",
            "SECRET_FILE_SYMLINK_NOT_ALLOWED",
            "SECRET_FILE_PERMISSIONS_NOT_600",
        }
        print("VOICE_ORIGINS_NOT_UPDATED: " + (str(error) if str(error) in allowed else "INVALID_CONFIG"))
        return 1
    except OSError:
        print("VOICE_ORIGINS_NOT_UPDATED: SECRET_FILE_UNAVAILABLE")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
