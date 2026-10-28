#!/usr/bin/env python3
"""Enable the separately hosted voice preview after it is deployed.

Only modifies two non-secret settings in the existing private voice.env.
No credentials are displayed. Production websites and Akira are untouched.
"""
import os
from pathlib import Path
import stat
import tempfile

ENV = Path("/etc/shakilm-secrets/voice.env")
PREVIEW = Path("/opt/shakilm-preview/current/index.html")
ORIGIN = "https://voice.soverixnet.online"


def change(source):
    lines = source.splitlines()
    found = [i for i, row in enumerate(lines) if row.startswith("ALLOWED_ORIGINS=")]
    if len(found) != 1:
        raise ValueError("ORIGINS_MISSING_OR_DUPLICATED")
    index = found[0]
    origins = [o.strip() for o in lines[index].split("=", 1)[1].split(",") if o.strip()]
    if ORIGIN not in origins:
        origins.append(ORIGIN)
    lines[index] = "ALLOWED_ORIGINS=" + ",".join(origins)
    positions = [i for i, row in enumerate(lines) if row.startswith("LIVEKIT_PRIMARY_FOR_UNSET_ROOMS=")]
    if len(positions) > 1:
        raise ValueError("PRIMARY_SETTING_DUPLICATED")
    if positions:
        lines[positions[0]] = "LIVEKIT_PRIMARY_FOR_UNSET_ROOMS=true"
    else:
        lines.append("LIVEKIT_PRIMARY_FOR_UNSET_ROOMS=true")
    return "\n".join(lines) + "\n"


def main():
    if os.geteuid() != 0:
        print("PREVIEW_VOICE_NOT_ENABLED: ROOT_REQUIRED")
        return 1
    try:
        if not PREVIEW.is_file():
            raise ValueError("PREVIEW_MUST_BE_BUILT_FIRST")
        if ENV.is_symlink():
            raise ValueError("SECRET_PATH_SYMLINK_NOT_ALLOWED")
        info = ENV.stat()
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600:
            raise ValueError("PRIVATE_ENV_PERMISSIONS_INVALID")
        original = ENV.read_text(encoding="utf-8")
        updated = change(original)
        if updated == original:
            print("PREVIEW_VOICE_ALREADY_ENABLED")
            return 0
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8",
                                             prefix=".voice-env-preview-",
                                             dir=ENV.parent, delete=False) as handle:
                temporary = Path(handle.name)
                os.fchmod(handle.fileno(), 0o600)
                os.fchown(handle.fileno(), info.st_uid, info.st_gid)
                handle.write(updated)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, ENV)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        print("PREVIEW_VOICE_CONFIG_READY: LiveKit primary for test clients and voice-origin allowed")
        print("Credentials were not printed. Restart only shakilm-voice-only-staging to apply.")
        return 0
    except ValueError as error:
        print("PREVIEW_VOICE_NOT_ENABLED: " + str(error))
    except (OSError, UnicodeError):
        print("PREVIEW_VOICE_NOT_ENABLED: PRIVATE_ENV_OR_PREVIEW_UNAVAILABLE")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
