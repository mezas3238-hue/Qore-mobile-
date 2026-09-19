# VPS Runtime Telemetry Bridge

This sidecar is observation-only. It does not import or call any order submission
API. It reads the already-running FundedNext MT5 account state and QORE runtime
heartbeat/safety files, then sends signed full reconciliation snapshots to the
QORE Mobile Gateway.

The bridge is deliberately outside qore-core. Trading must continue unchanged if
the bridge or Gateway fails.

Production secrets are deployment material and must not be committed. The HMAC
secret is read from a local file on the VPS and the matching credential is held
only in the Gateway environment.

The current runtime publishes these trader identities:

- VT08_FOREX
- R34_XAUUSD
- R38_EURUSD
- R43_GBPUSD
- R38_GBPJPY
- R42_AUDJPY

The bridge publishes every 2 seconds by default and uses the same mobile
freshness thresholds as the Gateway.
