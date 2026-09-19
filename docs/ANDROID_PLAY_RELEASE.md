# QORE Mobile — Android / Google Play release

## Security boundary

QORE Mobile has two different classes of credentials and they must never be
confused.

### Mobile enrollment credential

The one-time enrollment code is typed directly into QORE Mobile on the phone.
The app checks the device security state, requests biometric/device-owner
authentication before enrollment, sends the code over HTTPS to the Gateway,
then clears it from the UI. The code is not embedded in the APK/AAB and is not
stored in GitHub.

### Google Play upload signing key

The Google Play upload key signs the Android App Bundle *before* installation.
It must never be typed into QORE Mobile, committed to the repository, embedded
in the application, or copied into widget storage.

The upload keystore stays outside the repository on the Owner's build machine.
QORE's Gradle release config accepts signing material only from:

1. transient local environment variables, or
2. an ignored local `apps/mobile/android/key.properties` file.

There is no debug-signing fallback for release builds.

## Local signing helper scripts

Two PowerShell helpers are provided and contain no credentials:

- `apps/mobile/tool/generate_android_upload_key.ps1` creates the Google Play
  upload keystore on the Owner-controlled computer using `keytool`.
- `apps/mobile/tool/sign_android_bundle.ps1` signs an already-built unsigned
  AAB using `jarsigner`; passwords are entered interactively and exist only in
  process environment variables during signing.

The upload keystore must remain off GitHub, Railway and the trading VPS.

## Recommended Owner flow

### 1. Create the upload key locally

Run `keytool` on the Owner-controlled computer and save the keystore outside
the repository, for example under a dedicated private QORE secrets directory.

Example command structure:

```powershell
keytool -genkeypair -v -keystore C:\QORE-secrets\qore-upload.jks -alias qore-upload -keyalg RSA -keysize 4096 -validity 10000
```

Do not commit or upload this keystore to the repository.

### 2. Build the signed AAB locally

From the repository root, run:

```powershell
.\apps\mobile\tool\build_android_release.ps1 `
  -GatewayUrl "https://YOUR-REAL-QORE-GATEWAY" `
  -KeystorePath "C:\QORE-secrets\qore-upload.jks" `
  -KeyAlias "qore-upload"
```

PowerShell asks for the keystore and key passwords interactively. They are
placed only in transient process environment variables for the duration of the
build and are removed in the script's `finally` block.

Expected output:

```text
apps/mobile/build/app/outputs/bundle/release/app-release.aab
```

### 3. Use Google Play internal testing first

Enroll the application in Google Play App Signing, upload the signed AAB to an
Internal Testing release, add the Owner account as a tester, and install QORE
Mobile from the Google Play testing link.

The home-screen widget ships inside the same application. It is not a separate
APK.

## CI behavior

GitHub CI does **not** receive the production upload key.

CI compiles an unsigned release AAB with an invalid non-production Gateway URL
only to prove that release code, Android native security, and the widget compile
successfully. The Security Gate rejects any return to debug signing for the
release build and verifies that local signing inputs remain git-ignored.

## Production prerequisites before Owner installation

A production/internal-test build must use:

- the real HTTPS QORE Mobile Gateway URL;
- the Owner-controlled Google Play upload key;
- the same stable Android application ID;
- a monotonically increasing Android version code;
- a Google Play Internal Testing release accepted by Play Console.

No MT5, broker, prop-firm, VPS, QORE Core runtime, or trading credential belongs
in the mobile release signing process.
