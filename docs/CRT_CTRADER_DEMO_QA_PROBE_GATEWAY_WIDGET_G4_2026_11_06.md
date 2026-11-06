# CRT IC Markets DEMO → QORE Mobile widget: QA transport handshake (G4)

**Corte 2026-11-06. QA/STAGING ONLY · NO LIVE · NO MERGE · NO SIGNALS · NO TRADING.**

## What is implemented

Two preexisting components are linked using a strictly opt-in diagnostic receipt:

- cTrader DEMO worker: qore-deepseek-reviewer, `qore-crt-alerts/scripts/railway-ctrader-demo-entry.mjs` and `qore-crt-alerts/src/qa-ctrader-mobile-probe-bridge.mjs`.
- QORE Mobile gateway: `POST /v1/admin/crt/ctrader-demo-probe` with raw-body HMAC-SHA256, timestamp and nonce. Active ONLY if environment is qa/test/staging AND `QORE_CTRADER_DEMO_PROBE_ENABLED=true` AND a secret length >=32 is supplied privately.
- QORE Mobile read side: authenticated `GET /v1/crt/ctrader-demo-probe` with existing mobile Ed25519/device session. Contains no quotes, account ID, credentials, CRT signals, trade offers or FCM token.
- Android widget uses the same authenticated session to check the QA connection state no more frequently than its existing 30-second CRT poll. It displays `cTrader IC DEMO · QA recibido · no certificado` if recent, otherwise `sin conexión QA`. Existing CRT QA inbox has higher priority. If transport is unavailable or data invalid, it fails closed.
- The approved Pine V34.12X indicator remains 100% unchanged. User-specific ringtone/vibration setting remains on the separate CRT Android channel in PR #128.

## HMAC canonical form

Header fields:
- `X-Qore-Ctrader-Time`: epoch milliseconds decimal, time window ±60 seconds.
- `X-Qore-Ctrader-Nonce`: UUID-like lowercase hex/dash, unique for 180s in process.
- `X-Qore-Ctrader-Signature`: prefix `v1=` plus hex HMAC SHA256.

Canonical bytes (UTF8):
`POST\n/v1/admin/crt/ctrader-demo-probe\n{time_ms}\n{nonce}\n{sha256_hex(raw_json)}`

The receiver validates HMAC before JSON parsing. Timestamp, nonce, QA mode, DEMO, scope accounts, canTrade=false, push=false, live=false, no source parity, broker assertion, count boundaries and 90s status expiry are mandatory. A worker restart forgets nonce cache but the replay time-window still applies. It is a QA diagnostic, not a signal intake.

## Private settings necessary to actually execute (NOT SET YET)

On the **QORE Mobile gateway QA/STAGING service (not production)**:
- `QORE_GATEWAY_ENV=staging`
- `QORE_CTRADER_DEMO_PROBE_ENABLED=true`
- `QORE_CTRADER_DEMO_PROBE_HMAC_SECRET=<random high-entropy 32+ bytes>` (secret, not code)

On the **qore-crt-alerts-qa readonly worker** (staging):
- cTrader Open API view-only variables described in `qore-crt-alerts/docs/CTRADER_DEMO_VIEW_ONLY_RAILWAY_STAGING_G2_2026_11_04.md`; account MUST be DEMO, scope `accounts`, no trading access.
- `QORE_CTRADER_QA_MOBILE_BRIDGE=OWNER_APPROVED_PROBE_ONLY`
- `QORE_CTRADER_DEMO_PROBE_HMAC_SECRET=<same private secret>`
- `QORE_CTRADER_QA_GATEWAY_URL=https://<qa-or-staging-gateway>.up.railway.app/` (never production URL).
- QA worker only emits one proof after a **successful, explicitly authorized DEMO view-only probe**. Default disabled; no endless retries or continuous stream.

**Do NOT reuse the Railway project `qore-mobile-staging`** — inspected source points to `/apps/mobility-expo`, which belongs to the Movete Fácil app. Also do not change QORE Mobile **production** gateway source or secrets.

## Gate results and remaining blockers

- GitHub tests: receiver refuses unsigned/malformed/stale/replayed proofs, fake LIVE scope, market push and unauthorized environments; authenticated Android client can see status but no market alert. Source worker tests sign exact canonical bytes, block inappropriate URLs and payloads, mock gateway.
- No end-to-end network delivery yet: the two CRT Railway services in project `qore-crt-alerts-qa` are **staged-create**, no deployments, no private OAuth token; the QORE Mobile production gateway is on an older branch. There is no separate approved QA gateway deployment for this module.
- **Next:** securely configure a dedicated QA gateway from the branch after review, then configure the cTrader read-only worker; perform one real DEMO inventory proof (no M5 triggers) to Android Widget. Certify true IC Markets closed M5 and seven CRT+MSS families against Pine before any real-market alert/push is enabled.
- **Signing blocker:** direct-install APK uses a new ephemeral keystore per build. Never overwrite or uninstall the installed biometric QORE Mobile app without a verified compatible signing key and versionCode.

## Explicit limits

A signed `QA_PROBE_RECEIVED` receipt proves only that a server holding the shared HMAC secret sent a self-consistent *report* of the QA worker's last probe. It does not independently verify IC Markets credentials, full 34 feeds, TradingView OHLC parity, market signal correctness, or notification arrival when app is killed. No orders, no FCM, no alert() webhook, no live service changes in this PR.
