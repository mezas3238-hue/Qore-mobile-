# ADR 0004 — Widgets consume a sanitized app snapshot

Status: Accepted

Date: 2026-09-18

## Context

Android and iOS home-screen widgets may be visible while the device is locked or to someone other than the account Owner.

Widgets also have different lifecycle constraints from the foreground application.

Giving a widget direct Gateway credentials would unnecessarily expand the credential attack surface.

## Decision

Android and iOS widgets never authenticate directly to QORE Mobile Gateway.

The authenticated foreground app produces a small sanitized widget snapshot. Native widget targets read only that sanitized snapshot through the platform-approved shared storage boundary.

The default snapshot contains only:

- aggregate equity
- realized P/L today
- floating P/L
- aggregate daily drawdown only when explicitly supplied by QORE Risk
- active position count
- healthy runtime count
- total runtime count
- freshness
- generated timestamp
- expiry timestamp

The default snapshot does not contain:

- MT5 credentials
- Gateway bearer tokens
- runtime HMAC secrets
- account login numbers
- raw position tickets
- trader methodology
- CIBO internal reasoning
- order-entry controls

## Failure behavior

A widget snapshot has an explicit expiry time.

After expiry, the widget must visibly render stale/offline state instead of presenting the previous values as current.

## Consequences

- widgets remain useful without becoming credential holders;
- mobile read authentication remains inside the application/session layer;
- native Android/iOS widget implementations can evolve independently while consuming the same versioned snapshot.
