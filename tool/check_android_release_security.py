from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GRADLE = ROOT / "apps" / "mobile" / "android" / "app" / "build.gradle.kts"
LOCAL_KEY_PROPERTIES = ROOT / "apps" / "mobile" / "android" / "key.properties"

REQUIRED_ENV_NAMES = {
    "QORE_ANDROID_KEYSTORE_PATH",
    "QORE_ANDROID_STORE_PASSWORD",
    "QORE_ANDROID_KEY_ALIAS",
    "QORE_ANDROID_KEY_PASSWORD",
}


def main() -> None:
    text = GRADLE.read_text(encoding="utf-8")
    violations: list[str] = []

    if 'signingConfigs.getByName("debug")' in text:
        violations.append("Android release must never use the debug signing key")

    missing = sorted(name for name in REQUIRED_ENV_NAMES if name not in text)
    if missing:
        violations.append(
            "Android release signing contract is missing: " + ", ".join(missing)
        )

    ignored = subprocess.run(
        ["git", "check-ignore", "-q", str(LOCAL_KEY_PROPERTIES.relative_to(ROOT))],
        cwd=ROOT,
        check=False,
    ).returncode == 0
    if not ignored:
        violations.append(
            "apps/mobile/android/key.properties must remain git-ignored"
        )

    tracked = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True)
    if "apps/mobile/android/key.properties" in tracked.splitlines():
        violations.append("apps/mobile/android/key.properties must not be tracked")

    if violations:
        raise SystemExit("\n".join(violations))

    print(
        "QORE Android release signing gate passed: "
        "no debug fallback and local signing inputs remain outside GitHub"
    )


if __name__ == "__main__":
    main()
