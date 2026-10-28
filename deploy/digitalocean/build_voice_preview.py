#!/usr/bin/env python3
"""Build a separate LiveKit-primary test frontend on DigitalOcean.

No live app files are replaced; the source branch is archived from tracked files.
The build runs in a resource-limited, disposable Docker container.
Only /opt/shakilm-preview/current is switched atomically after a successful build.
"""
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path("/opt/shakilm-voice")
ROOT = Path("/opt/shakilm-preview")
BRANCH = "feature/shakilm-voice-only-do-staging-20261028"


def git(*args):
    return subprocess.check_output(["git", "-C", str(SOURCE), *args], timeout=20)


def main():
    if os.geteuid() != 0:
        print("PREVIEW_NOT_BUILT: ROOT_REQUIRED")
        return 1
    if not SOURCE.is_dir() or not (SOURCE / ".git").exists():
        print("PREVIEW_NOT_BUILT: STAGING_CHECKOUT_MISSING")
        return 1
    try:
        active = git("branch", "--show-current").decode().strip()
        if active != BRANCH:
            raise ValueError("WRONG_BRANCH")
        commit = git("rev-parse", "--short=12", "HEAD").decode().strip()
        if len(commit) != 12 or any(c not in "0123456789abcdef" for c in commit):
            raise ValueError("INVALID_COMMIT")
        if not shutil.which("docker"):
            raise ValueError("DOCKER_NOT_INSTALLED")
        if ROOT.is_symlink():
            raise ValueError("PREVIEW_ROOT_SYMLINK_NOT_ALLOWED")
        ROOT.mkdir(mode=0o755, parents=False, exist_ok=True)
        releases = ROOT / "releases"
        releases.mkdir(mode=0o755, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".source-build-", dir=ROOT) as temporary:
            build_dir = Path(temporary)
            paths = git("ls-files", "-z").split(b"\0")
            for raw in paths:
                if not raw:
                    continue
                relative = Path(os.fsdecode(raw))
                if relative.is_absolute() or ".." in relative.parts:
                    raise ValueError("UNSAFE_SOURCE_PATH")
                original = SOURCE / relative
                if original.is_symlink() or not original.is_file():
                    raise ValueError("UNSUPPORTED_SOURCE_FILE")
                copied = build_dir / relative
                copied.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(original, copied)
            command = [
                "docker", "run", "--rm",
                "--memory", "1280m", "--memory-swap", "1280m",
                "--cpus", "1.25", "--pids-limit", "180",
                "--security-opt", "no-new-privileges:true",
                "-v", str(build_dir) + ":/app", "-w", "/app",
                "-e", "NODE_OPTIONS=--max-old-space-size=960",
                "-e", "VITE_SHAKILM_VOICE_STAGING=true",
                "-e", "VITE_SHAKILM_LIVEKIT_PRIMARY=true",
                "node:24-alpine", "sh", "-euc",
                "npm install --no-save --package-lock=false --legacy-peer-deps --no-audit --no-fund && npm run build",
            ]
            log_path = ROOT / "build.log"
            with log_path.open("wb") as log:
                os.fchmod(log.fileno(), 0o600)
                result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=900, check=False)
            if result.returncode:
                raise ValueError("FRONTEND_BUILD_FAILED")
            dist = build_dir / "dist"
            if not (dist / "index.html").is_file() or not (dist / "assets").is_dir():
                raise ValueError("INVALID_BUILD_OUTPUT")
            rendered = (dist / "index.html").read_text(encoding="utf-8")
            if "src/main.tsx" in rendered or "assets/" not in rendered:
                raise ValueError("FRONTEND_NOT_BUNDLED")
            # Releases are immutable and recoverable; old releases are not deleted.
            release = releases / (commit + "-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
            if release.exists():
                raise ValueError("RELEASE_CONFLICT")
            shutil.copytree(dist, release, symlinks=False)
            link = ROOT / "current"
            if link.exists() and not link.is_symlink():
                raise ValueError("CURRENT_PATH_NOT_A_SYMLINK")
            new_link = ROOT / (".current-" + commit)
            if new_link.exists() or new_link.is_symlink():
                raise ValueError("TEMP_LINK_CONFLICT")
            try:
                new_link.symlink_to(release.relative_to(ROOT), target_is_directory=True)
                os.replace(new_link, link)
            finally:
                if new_link.is_symlink():
                    new_link.unlink()
        print("LIVEKIT_PREVIEW_BUILT: " + commit)
        print("PREVIEW_ROOT: /opt/shakilm-preview/current")
        print("This does not change earnbd.work, Akira, LiveKit or Render.")
        return 0
    except subprocess.TimeoutExpired:
        print("PREVIEW_NOT_BUILT: BUILD_TIMEOUT")
    except subprocess.CalledProcessError:
        print("PREVIEW_NOT_BUILT: GIT_CHECK_FAILED")
    except ValueError as error:
        print("PREVIEW_NOT_BUILT: " + str(error))
    except OSError:
        print("PREVIEW_NOT_BUILT: FILE_OR_DOCKER_ERROR")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
