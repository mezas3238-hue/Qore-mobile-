# QORE Mobile Realtime Event Contract

Version: 0.1

Realtime transport is intentionally implementation-neutral at this stage.

Every event envelope must contain:

```json
{
  "schema_version": "0.1",
  "event_id": "opaque-id",
  "event_type": "runtime.heartbeat",
  "runtime_id": "runtime-id",
  "account_id": "account-id",
  "sequence": 123,
  "event_time": "2026-09-18T23:00:00Z",
  "emitted_at": "2026-09-18T23:00:00Z",
  "payload": {}
}
```

## Event families

- `runtime.heartbeat`
- `account.snapshot`
- `risk.snapshot`
- `trader.state`
- `position.opened`
- `position.updated`
- `position.closed`
- `alert.raised`
- `alert.resolved`

## Sequence rule

Sequence is monotonic per runtime. A detected gap forces the mobile client to refresh the canonical REST snapshot before trusting incremental state again.

## Time rule

The Gateway records both source event time and gateway receive time. The application derives freshness from authenticated server state, not from the phone clock alone.

## Governance

No realtime event in version 0.1 represents an order command or changes execution authority.
