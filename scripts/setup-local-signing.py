#!/usr/bin/env python3
"""Create one persistent personal code-signing identity; never publish its private key."""
from pathlib import Path
import json
import secrets
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
directory = root / ".tmp/local-signing"
directory.mkdir(parents=True, exist_ok=True)
directory.chmod(0o700)
configuration = directory / "config.json"


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{Path(args[0]).name} failed ({result.returncode}): {result.stderr.strip()}")
    return result.stdout.strip()


if configuration.exists():
    print("Local signing identity is already configured")
else:
    password = secrets.token_hex(32)
    keychain = directory / "Orzi Code.keychain-db"
    if keychain.exists():
        raise RuntimeError("Unfinished signing setup exists; preserve and inspect it before retrying")
    with tempfile.TemporaryDirectory(dir=directory) as scratch:
        work = Path(scratch)
        key = work / "key.pem"
        cert = work / "cert.pem"
        bundle = work / "identity.p12"
        extensions = work / "extensions.cnf"
        extensions.write_text("[req]\ndistinguished_name=dn\nx509_extensions=code\nprompt=no\n[dn]\nCN=Orzi Code Local Signing\n[code]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=critical,codeSigning\n")
        run("/usr/bin/openssl", "req", "-new", "-newkey", "rsa:3072", "-nodes", "-x509", "-days", "3650", "-config", str(extensions), "-keyout", str(key), "-out", str(cert))
        run("/usr/bin/openssl", "pkcs12", "-export", "-inkey", str(key), "-in", str(cert), "-out", str(bundle), "-passout", "pass:" + password)
        run("/usr/bin/security", "create-keychain", "-p", password, str(keychain))
        run("/usr/bin/security", "unlock-keychain", "-p", password, str(keychain))
        run("/usr/bin/security", "import", str(bundle), "-k", str(keychain), "-P", password, "-T", "/usr/bin/codesign")
        # User trust applies only to code signing, not TLS or unrelated purposes.
        run("/usr/bin/security", "add-trusted-cert", "-r", "trustRoot", "-p", "codeSign", "-k", str(keychain), str(cert))
        fingerprint = run("/usr/bin/openssl", "x509", "-in", str(cert), "-noout", "-fingerprint", "-sha1").split("=", 1)[1].replace(":", "")
        password_file = directory / "password"
        password_file.write_text(password)
        password_file.chmod(0o600)
        configuration.write_text(json.dumps({"identity": fingerprint, "keychain": str(keychain), "passwordFile": str(password_file)}) + "\n")
        configuration.chmod(0o600)
    run("/usr/bin/security", "lock-keychain", str(keychain))
    print("Persistent local signing configured")
