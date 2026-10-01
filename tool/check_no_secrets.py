from __future__ import annotations

import re
import subprocess
from pathlib import Path


FORBIDDEN_TRACKED_NAMES = {
    ".env",
    "google-services.json",
    "GoogleService-Info.plist",
}
FORBIDDEN_SUFFIXES = {
    ".jks",
    ".keystore",
    ".p12",
    ".pfx",
    ".mobileprovision",
}
SECRET_PATTERNS = {
    "private key": re.compile(
        rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
    ),
    "github token": re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}"),
    "aws access key": re.compile(rb"AKIA[0-9A-Z]{16}"),
    "openai-style key": re.compile(rb"sk-[A-Za-z0-9_-]{20,}"),
}


def tracked_files() -> list[Path]:
    raw = subprocess.check_output(["git", "ls-files", "-z"])
    return [Path(item.decode()) for item in raw.split(b"\0") if item]


def main() -> None:
    violations: list[str] = []
    for path in tracked_files():
        name = path.name
        if name in FORBIDDEN_TRACKED_NAMES:
            violations.append(f"forbidden tracked secret file: {path}")
            continue
        if any(name.endswith(suffix) for suffix in FORBIDDEN_SUFFIXES):
            violations.append(f"forbidden credential artifact: {path}")
            continue
        if name.startswith(".env.") and not name.endswith(".example"):
            violations.append(f"forbidden tracked environment file: {path}")
            continue

        try:
            data = path.read_bytes()
        except OSError:
            continue
        if b"\0" in data[:4096]:
            continue

        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(data):
                violations.append(f"{label} pattern detected: {path}")

    if violations:
        raise SystemExit("\n".join(violations))

    print("QORE secret gate passed: no forbidden tracked credentials detected")


if __name__ == "__main__":
    main()
