# Android Widget

Planned native implementation: Kotlin.

## Data boundary

The Android widget does **not** authenticate to QORE Mobile Gateway.

It consumes only the sanitized snapshot defined by:

- `contracts/widget-snapshot-v1.schema.json`
- `docs/adr/0004-widget-sanitized-snapshot.md`

The authenticated Flutter application produces the snapshot and writes it through the future Android shared-storage bridge.

## Visible MVP fields

- daily portfolio P/L
- equity
- daily drawdown only when QORE Risk supplies an explicit aggregate
- active positions
- healthy/total runtimes
- freshness
- last refresh time

## Security

The widget never receives:

- MT5/provider credentials
- Gateway Bearer token
- runtime HMAC secret
- account login numbers
- order-entry controls

An expired snapshot must render stale/offline state rather than silently presenting old data as current.

Native implementation begins once the generated Android host target and shared-storage bridge are committed.
