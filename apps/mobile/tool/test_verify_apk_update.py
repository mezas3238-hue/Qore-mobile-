"""Tests for the QORE Mobile APK-update verifier; no Android SDK required."""
import unittest
from unittest.mock import patch
from pathlib import Path

from verify_apk_update import BADGING_RE, SIGNER_RE, compare, inspect_apk, PACKAGE


class VerifyApkUpdateTests(unittest.TestCase):
    def setUp(self):
        self.fingerprint = "ab" * 32
        self.installed = {
            "package": PACKAGE, "version_code": 1,
            "version_name": "0.1.0", "cert_sha256": self.fingerprint,
        }
        self.candidate = {
            "package": PACKAGE, "version_code": 2,
            "version_name": "0.2.0", "cert_sha256": self.fingerprint,
        }

    def test_accept_only_same_package_cert_and_higher_version(self):
        self.assertTrue(compare(self.installed, self.candidate)["safe_inplace_update"])

    def test_reject_rotated_or_ephemeral_signing_key(self):
        other = {**self.candidate, "cert_sha256": "cd" * 32}
        r = compare(self.installed, other)
        self.assertFalse(r["safe_inplace_update"])
        self.assertFalse(r["same_signing_certificate"])

    def test_reject_downgrade_or_equal_version(self):
        for v in [0, 1, -1]:
            with self.subTest(version_code=v):
                c = {**self.candidate, "version_code": v}
                self.assertFalse(compare(self.installed, c)["safe_inplace_update"])

    def test_reject_different_package_and_missing_signer(self):
        self.assertFalse(compare(self.installed, {
            **self.candidate, "package": "com.qore.crtalerts.qa",
        })["safe_inplace_update"])
        self.assertFalse(compare(self.installed, {
            **self.candidate, "cert_sha256": None,
        })["safe_inplace_update"])

    def test_parse_expected_android_sdk_output(self):
        txt = "package: name='com.qore.mobile.qore_mobile' versionCode='2' versionName='0.2.0'\n"
        self.assertEqual(BADGING_RE.search(txt).groups(),
            ("com.qore.mobile.qore_mobile", "2", "0.2.0"))
        signed = "Verified using v2 scheme (APK Signature Scheme v2): true\n"
        signed += "Signer #1 certificate SHA-256 digest: " + self.fingerprint + "\n"
        self.assertEqual(SIGNER_RE.findall(signed), [("1", self.fingerprint)])

    def test_fail_closed_multiple_signers(self):
        sample = [
            "package: name='com.qore.mobile.qore_mobile' versionCode='2' versionName='0.2.0'\n",
            "Signer #1 certificate SHA-256 digest: " + self.fingerprint + "\n" +
            "Signer #2 certificate SHA-256 digest: " + self.fingerprint + "\n",
        ]
        with patch("verify_apk_update.android_tool", side_effect=["aapt", "apksigner"]), \
            patch("verify_apk_update.execute", side_effect=sample), \
            patch.object(Path, "is_file", return_value=True), \
            patch.object(Path, "stat", return_value=type("Stat", (), {"st_size": 2_000_000})()):
            with self.assertRaisesRegex(ValueError, "APK_SINGLE_SIGNER_REQUIRED"):
                inspect_apk(Path("sample.apk"))


if __name__ == "__main__":
    unittest.main()
