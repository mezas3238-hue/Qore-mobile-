#!/usr/bin/env python3
"""Fail-closed QORE Mobile Android UPDATE compatibility verifier.

Usage:
  python apps/mobile/tool/verify_apk_update.py INSTALLED.apk CANDIDATE.apk

Inspect the installed APK (retrieved/exported legally from the owner's phone)
and candidate bytes; no remote endpoint, key store or credential required.
This script never signs or installs an APK. APK signer lineage rotations are
intentionally not accepted automatically; handle those only after owner audit.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

PACKAGE = "com.qore.mobile.qore_mobile"
BADGING_RE = re.compile(
    r"^package:\s+name='([^']+)'\s+versionCode='([0-9]+)'"
    r"\s+versionName='([^']*)'", re.MULTILINE
)
SIGNER_RE = re.compile(
    r"^Signer #([0-9]+) certificate SHA-256 digest:\s*([a-fA-F0-9]{64})\s*$",
    re.MULTILINE,
)


def android_tool(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if root:
        matches = list((Path(root) / "build-tools").glob(f"*/{name}"))
        if matches:
            return str(sorted(matches, key=lambda x: x.parent.name)[-1])
    raise ValueError(f"ANDROID_SDK_TOOL_MISSING: {name}")


def execute(args: list[str]) -> str:
    result = subprocess.run(args, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        # Do not return raw tool logs; they may contain paths or unusual bytes.
        raise ValueError(f"ANDROID_TOOL_REJECTED: {Path(args[0]).name}")
    return result.stdout


def inspect_apk(path: Path) -> dict:
    if not path.is_file() or not path.name.lower().endswith(".apk"):
        raise ValueError("APK_FILE_REQUIRED")
    if path.stat().st_size < 1000 or path.stat().st_size > 600_000_000:
        raise ValueError("APK_SIZE_OUT_OF_BOUNDS")
    badging = execute([android_tool("aapt"), "dump", "badging", str(path)])
    match = BADGING_RE.search(badging)
    if not match:
        raise ValueError("APK_PACKAGE_METADATA_MISSING")
    signers = execute([android_tool("apksigner"), "verify", "--print-certs", str(path)])
    matches = SIGNER_RE.findall(signers)
    if len(matches) != 1 or matches[0][0] != "1":
        raise ValueError("APK_SINGLE_SIGNER_REQUIRED")
    return {
        "package": match[1],
        "version_code": int(match[2]),
        "version_name": match[3],
        "cert_sha256": matches[0][1].lower(),
    }


def compare(current: dict, candidate: dict) -> dict:
    result = {
        "package_matches": (
            current.get("package") == PACKAGE and candidate.get("package") == PACKAGE
        ),
        "same_signing_certificate": (
            bool(current.get("cert_sha256")) and
            current.get("cert_sha256") == candidate.get("cert_sha256")
        ),
        "newer_version_code": (
            isinstance(current.get("version_code"), int) and
            isinstance(candidate.get("version_code"), int) and
            candidate["version_code"] > current["version_code"]
        ),
    }
    result["safe_inplace_update"] = all(result.values())
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("installed_apk", type=Path)
    parser.add_argument("candidate_apk", type=Path)
    args = parser.parse_args()
    try:
        installed = inspect_apk(args.installed_apk)
        candidate = inspect_apk(args.candidate_apk)
        result = compare(installed, candidate)
        print(json.dumps({
            "installed": installed, "candidate": candidate, **result,
            "note": "A match does not test Android/device data integrity or behavior.",
        }, indent=2))
        return 0 if result["safe_inplace_update"] else 2
    except ValueError as exc:
        print(json.dumps({"safe_inplace_update": False, "error": str(exc)}))
        return 3


if __name__ == "__main__":
    sys.exit(main())
