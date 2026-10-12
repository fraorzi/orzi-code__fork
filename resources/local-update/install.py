#!/usr/bin/env python3
"""Detached local macOS installer. Manifest v1 mirrors src/shared/localUpdate.ts."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import signal
import subprocess
import time
import uuid

MANIFEST_VERSION = 1
ALLOWED_IDS = {"com.franciszek.poracode.personal", "com.franciszek.poracode.personal.nightly"}


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()


def info(bundle):
    with (bundle / "Contents/Info.plist").open("rb") as stream:
        return plistlib.load(stream)


def digest(bundle):
    value = hashlib.sha256()
    for filename in ["Contents/Resources/app.asar", "Contents/_CodeSignature/CodeResources"]:
        with (bundle / filename).open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                value.update(chunk)
    return value.hexdigest()


def verify(bundle, app_id, sha256=None):
    if app_id not in ALLOWED_IDS or info(bundle)["CFBundleIdentifier"] != app_id:
        raise RuntimeError("Application identity mismatch")
    run("/usr/bin/codesign", "--verify", "--deep", "--strict", str(bundle))
    if sha256 is not None and digest(bundle) != sha256:
        raise RuntimeError("Archive checksum mismatch")


def atomic_json(path, value):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value) + "\n")
    temp.chmod(0o600)
    temp.replace(path)


def processes():
    result = {}
    for line in run("/bin/ps", "-axo", "pid=,ppid=,comm=").splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) == 3:
            result[int(parts[0])] = (int(parts[1]), parts[2])
    return result


def wait_for_exit(pid, timeout=120):
    rows = processes()
    owned = {pid} if pid in rows else set()
    while True:
        expanded = owned | {p for p, (parent, _) in rows.items() if parent in owned}
        if expanded == owned:
            break
        owned = expanded
    owned.discard(os.getpid())
    deadline = time.monotonic() + timeout
    while owned.intersection(processes()):
        if time.monotonic() > deadline:
            raise RuntimeError("Application did not close; installation was cancelled")
        time.sleep(0.2)


def stage(source, profile):
    source = source.resolve(strict=True)
    app_id = info(source)["CFBundleIdentifier"]
    verify(source, app_id)
    sha256 = digest(source)
    update_dir = profile / "local-updates"
    update_dir.mkdir(parents=True, exist_ok=True)
    destination = update_dir / sha256 / source.name
    if not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        run("/usr/bin/ditto", str(source), str(destination))
    verify(destination, app_id, sha256)
    atomic_json(update_dir / "ready.json", {
        "version": MANIFEST_VERSION, "bundlePath": str(destination), "appId": app_id,
        "appVersion": info(source)["CFBundleShortVersionString"], "sha256": sha256,
        "createdAt": int(time.time() * 1000),
    })
    print("Local update staged")


def _install(profile, target, pid, expected):
    update_dir = profile / "local-updates"
    manifest = json.loads((update_dir / "ready.json").read_text())
    if manifest["version"] != MANIFEST_VERSION or manifest["sha256"] != expected:
        raise RuntimeError("Staged update changed or has an unsupported manifest")
    source = Path(manifest["bundlePath"]).resolve(strict=True)
    source.relative_to(update_dir.resolve())
    target = target.resolve(strict=True)
    app_id = manifest["appId"]
    verify(source, app_id, expected)
    verify(target, app_id)
    # Check the whole bundle identity, including nested executables, before quit.
    staging = target.parent / ("." + target.stem + ".installing-" + uuid.uuid4().hex + ".app")
    backup = update_dir / "backups" / (time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8])
    replaced = False
    try:
        run("/usr/bin/ditto", str(source), str(staging))
        verify(staging, app_id, expected)
        wait_for_exit(pid)
        # Another instance on the same profile must not be replaced underneath it.
        executable = str(target / "Contents/MacOS" / info(target)["CFBundleExecutable"])
        if any(command == executable for _, command in processes().values()):
            raise RuntimeError("Another application instance is still running")
        backup.mkdir(parents=True)
        shutil.copytree(profile, backup / "profile", ignore=shutil.ignore_patterns("local-updates"))
        target.rename(backup / target.name)
        try:
            staging.rename(target)
            replaced = True
            verify(target, app_id, expected)
            (update_dir / "started.json").unlink(missing_ok=True)
            run("/usr/bin/open", "-n", "-a", str(target), "--env", "PORACODE_BASE_DIR=" + str(profile))
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                try:
                    started = json.loads((update_dir / "started.json").read_text())
                    if started["sha256"] == expected:
                        atomic_json(update_dir / "result.json", {"status": "installed", "sha256": expected, "backup": str(backup)})
                        print("Installed and restarted")
                        return
                except (FileNotFoundError, ValueError, KeyError):
                    pass
                time.sleep(0.3)
            raise RuntimeError("Updated application did not acknowledge startup")
        except BaseException:
            # Only this install's new instance can exist after the preflight.
            for app_pid, (_, command) in processes().items():
                if command == executable:
                    os.kill(app_pid, signal.SIGTERM)
                    wait_for_exit(app_pid, 30)
            if target.exists():
                shutil.rmtree(target)
            (backup / target.name).rename(target)
            for entry in profile.iterdir():
                if entry.name != "local-updates":
                    if entry.is_dir() and not entry.is_symlink():
                        shutil.rmtree(entry)
                    else:
                        entry.unlink()
            shutil.copytree(backup / "profile", profile, dirs_exist_ok=True)
            run("/usr/bin/open", "-n", "-a", str(target), "--env", "PORACODE_BASE_DIR=" + str(profile))
            raise
    except BaseException as error:
        atomic_json(update_dir / "result.json", {"status": "rolled-back" if replaced else "failed", "error": str(error)})
        raise
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def install(profile, target, pid, expected):
    with (profile / "local-updates/install.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return _install(profile, target, pid, expected)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["stage", "install"])
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--target", type=Path)
    parser.add_argument("--wait-pid", type=int)
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.action == "stage":
        if not args.source:
            parser.error("--source is required")
        stage(args.source, args.profile.resolve())
    else:
        if not args.target or not args.wait_pid or not args.sha256:
            parser.error("--target, --wait-pid and --sha256 are required")
        install(args.profile.resolve(), args.target, args.wait_pid, args.sha256)
