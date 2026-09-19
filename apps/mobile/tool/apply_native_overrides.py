from __future__ import annotations

import plistlib
import re
import shutil
from pathlib import Path


MOBILE = Path(__file__).resolve().parents[1]
TEMPLATES = MOBILE / "native_templates"


def require(path: Path) -> Path:
    if not path.exists():
        raise RuntimeError(f"required generated path is missing: {path}")
    return path


def apply_android() -> None:
    android = require(MOBILE / "android")
    main_candidates = list(
        (android / "app" / "src" / "main" / "kotlin").glob(
            "**/MainActivity.kt"
        )
    )
    if len(main_candidates) != 1:
        raise RuntimeError(
            f"expected one MainActivity.kt, found {len(main_candidates)}"
        )

    main_activity = main_candidates[0]
    package_dir = main_activity.parent
    shutil.copyfile(
        TEMPLATES / "android" / "MainActivity.kt",
        main_activity,
    )
    shutil.copyfile(
        TEMPLATES / "android" / "QoreWidgetProvider.kt",
        package_dir / "QoreWidgetProvider.kt",
    )

    res = android / "app" / "src" / "main" / "res"
    (res / "layout").mkdir(parents=True, exist_ok=True)
    (res / "xml").mkdir(parents=True, exist_ok=True)
    (res / "values").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(
        TEMPLATES / "android" / "qore_widget.xml",
        res / "layout" / "qore_widget.xml",
    )
    shutil.copyfile(
        TEMPLATES / "android" / "qore_widget_info.xml",
        res / "xml" / "qore_widget_info.xml",
    )
    (res / "values" / "qore_strings.xml").write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="qore_app_name">QORE Mobile</string>
    <string name="qore_widget_description">Estado seguro de QORE Portfolio</string>
</resources>
""",
        encoding="utf-8",
    )

    manifest = android / "app" / "src" / "main" / "AndroidManifest.xml"
    text = manifest.read_text(encoding="utf-8")
    if "android.permission.INTERNET" not in text:
        text, count = re.subn(
            r"(<manifest\\b[^>]*>)",
            r'\\1\\n    <uses-permission android:name="android.permission.INTERNET" />',
            text,
            count=1,
            flags=re.DOTALL,
        )
        if count != 1:
            raise RuntimeError("could not patch Android manifest root")
    text = text.replace(
        'android:label="qore_mobile"',
        'android:label="@string/qore_app_name"',
    )
    if 'android:allowBackup=' not in text:
        text = text.replace(
            "<application",
            '<application android:allowBackup="false" '
            'android:usesCleartextTraffic="false"',
            1,
        )
    if "QoreWidgetProvider" not in text:
        receiver = """
        <receiver
            android:name=".QoreWidgetProvider"
            android:exported="false">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/qore_widget_info" />
        </receiver>
"""
        text = text.replace("</application>", receiver + "    </application>")
    manifest.write_text(text, encoding="utf-8")

    gradle = android / "app" / "build.gradle.kts"
    gradle_text = gradle.read_text(encoding="utf-8")
    gradle_text = gradle_text.replace(
        "minSdk = flutter.minSdkVersion",
        "minSdk = 28",
    )
    if 'androidx.biometric:biometric' not in gradle_text:
        gradle_text += """

dependencies {
    implementation("androidx.biometric:biometric:1.1.0")
}
"""
    gradle.write_text(gradle_text, encoding="utf-8")


def apply_ios_files() -> None:
    ios = require(MOBILE / "ios")
    runner = require(ios / "Runner")
    shutil.copyfile(
        TEMPLATES / "ios" / "AppDelegate.swift",
        runner / "AppDelegate.swift",
    )
    shutil.copyfile(
        TEMPLATES / "ios" / "QoreSecurityBridge.swift",
        runner / "QoreSecurityBridge.swift",
    )
    shutil.copyfile(
        TEMPLATES / "ios" / "Runner.entitlements",
        runner / "Runner.entitlements",
    )

    widget = ios / "QoreWidget"
    widget.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(
        TEMPLATES / "ios" / "QoreWidget.swift",
        widget / "QoreWidget.swift",
    )
    shutil.copyfile(
        TEMPLATES / "ios" / "QoreWidgetBundle.swift",
        widget / "QoreWidgetBundle.swift",
    )
    shutil.copyfile(
        TEMPLATES / "ios" / "QoreWidget-Info.plist",
        widget / "Info.plist",
    )
    shutil.copyfile(
        TEMPLATES / "ios" / "QoreWidget.entitlements",
        widget / "QoreWidget.entitlements",
    )

    info_path = runner / "Info.plist"
    with info_path.open("rb") as handle:
        info = plistlib.load(handle)
    info["NSFaceIDUsageDescription"] = (
        "QORE Mobile usa Face ID para desbloquear la supervisión de tus cuentas."
    )
    info["CFBundleDisplayName"] = "QORE Mobile"
    info["CFBundleURLTypes"] = [
        {
            "CFBundleTypeRole": "Editor",
            "CFBundleURLName": "com.qore.mobile.dashboard",
            "CFBundleURLSchemes": ["qore"],
        }
    ]
    with info_path.open("wb") as handle:
        plistlib.dump(info, handle, sort_keys=False)


def main() -> None:
    apply_android()
    apply_ios_files()
    print("QORE native overrides applied")


if __name__ == "__main__":
    main()
