# QORE Mobile Security Model

## Security objective

A lost or compromised phone must not expose MT5 credentials and must not create an execution path capable of bypassing QORE Core.

## Mandatory controls

### 1. No trading credentials on the phone

Never store or embed:

- MT5 login passwords
- investor/master passwords
- prop-firm portal passwords
- VPS administrator passwords
- broker API secrets
- QORE production signing secrets

The app receives normalized state from QORE Mobile Gateway.

### 2. Read-only first release

The initial API exposes supervision data only.

No endpoint in MVP may submit, modify or cancel an order.

### 3. Device session security

Production authentication must support:

- short-lived access tokens
- refresh-token rotation
- per-device session identity
- remote session revocation
- biometric gate for sensitive views
- secure OS key storage
- replay-resistant server authentication

### 4. Runtime authentication

Every QORE runtime sending telemetry must have a distinct credential/certificate identity.

Gateway rules:

- authenticate runtime before accepting telemetry
- bind runtime identity to allowed account IDs
- reject account spoofing
- reject duplicate/out-of-order sequence when unsafe
- record last accepted sequence and event time
- log authentication failures

### 5. Freshness is a security property

The UI must never silently display old telemetry as live.

Required metadata:

- source event time
- gateway receive time
- app snapshot time
- current connection/freshness state

### 6. Least privilege

Separate permissions for:

- telemetry ingestion
- mobile read API
- notification delivery
- administrative session revocation

Future write/control permissions must never be bundled into ordinary read tokens.

### 7. Auditability

Security-relevant events must be auditable:

- login
- logout
- token refresh
- device registration
- device revocation
- failed authentication
- runtime registration
- runtime authentication failure
- stale/offline transition

Audit events must never contain raw passwords, tokens or private keys.

## Threats explicitly considered

- stolen phone
- malicious mobile application build
- leaked GitHub source
- replayed telemetry
- runtime impersonation
- account ID spoofing
- stale-data confusion
- notification spoofing
- compromised mobile token
- accidental future addition of trading commands

## Secret handling

Repository policy:

- secrets never committed
- local secrets via ignored environment files
- production secrets supplied by deployment secret manager
- example files contain names only, never real values


## Current mobile read authorization boundary

The Gateway now denies portfolio/account/trader/position/runtime reads by default.

- `/v1/health` is intentionally unauthenticated for service health checks.
- all supervision data endpoints require an HTTP Bearer credential.
- the current foundation verifier stores only SHA-256 token hashes server-side.
- raw mobile tokens are not committed to GitHub.
- an empty token allowlist means all protected mobile reads fail closed.

This is an interim authorization boundary, not the final device enrollment design. The final session system must add device-bound enrollment, short-lived access tokens, refresh rotation and remote revocation without weakening the existing protected read boundary.

Runtime telemetry uses a separate credential class and cannot authenticate as a mobile reader merely by possessing a runtime signing secret.


## Device-bound session protocol

The final mobile read boundary is moving from bearer-only authentication to proof-of-possession sessions.

Each enrolled phone owns a native signing keypair:

- private key: generated/stored in the device secure key store and never sent to the Gateway;
- public key: registered with QORE Mobile Gateway during one-time enrollment.

Every protected request carries:

- short-lived access token;
- device ID;
- UTC proof timestamp;
- unique nonce;
- P-256 ECDSA signature over the canonical request.

Canonical proof input:

```text
METHOD
PATH
TIMESTAMP
NONCE
SHA256(BODY)
```

The Gateway rejects:

- unknown/revoked devices;
- expired access sessions;
- token/device mismatches;
- stale proof timestamps;
- repeated nonces;
- invalid signatures.

Refresh tokens are rotating and also require device proof. Using a refresh token revokes the previous session tokens before a replacement session is issued.

Remote device revocation invalidates all active sessions for that device.

This makes possession of an access/refresh token alone insufficient to impersonate the enrolled phone.


## Native signing algorithm

Production Android and iOS enrollment prefers P-256 ECDSA so the private key
can remain non-exportable in Android Keystore or Apple Secure Enclave.

- Android publishes the DER SubjectPublicKeyInfo representation as
  `key_algorithm=p256-spki`.
- iOS publishes the X9.63 uncompressed public representation as
  `key_algorithm=p256-x963`.
- Ed25519 remains accepted only for compatibility and automated tests.

The canonical request proof is unchanged; only the native signature algorithm
and public-key representation are versioned.
