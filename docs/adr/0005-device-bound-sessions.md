# ADR 0005 — Device-bound mobile sessions

Status: Accepted

Date: 2026-09-18

## Context

A bearer-only mobile token can be replayed from another machine if stolen.

QORE Mobile displays sensitive operational information. The read API therefore needs a stronger boundary even though MVP cannot submit trading commands.

## Decision

Each enrolled Android/iOS device owns a signing keypair.

The preferred native algorithm is P-256 ECDSA because Android Keystore and
Apple Secure Enclave can protect P-256 private keys without exporting them.
The Gateway also retains Ed25519 compatibility for non-production/testing
clients.

Android enrolls a P-256 SubjectPublicKeyInfo (`p256-spki`). iOS enrolls the
Secure Enclave P-256 X9.63 public representation (`p256-x963`).

The private key remains in OS-backed secure storage. The Gateway stores only
the public key, its algorithm identifier and hashed opaque session tokens.

Protected reads require both:

1. a valid short-lived access token; and
2. a valid cryptographic proof signed by the enrolled device key.

The proof covers:

- HTTP method
- request path
- UTC timestamp
- unique nonce
- SHA-256 of the request body

Access tokens expire after a short interval. Refresh tokens rotate and require the same device proof.

A used refresh token invalidates its previous access/refresh pair.

Administrators can remotely revoke a device, invalidating all of its active sessions.

## Enrollment

Enrollment uses a one-time out-of-band code.

Only SHA-256 hashes of allowed enrollment codes are configured in the Gateway. A successful enrollment consumes the code.

No enrollment code, device private key, access token or refresh token is committed to GitHub.

## Replay protection

The Gateway rejects:

- stale proof timestamps;
- repeated nonces;
- token/device mismatches;
- signatures from a different key;
- revoked devices.

## Consequences

A stolen access or refresh token alone cannot authenticate from another device.

Native Android/iOS work must provide an OS-backed Ed25519 signer and secure token storage before production enrollment is enabled.
