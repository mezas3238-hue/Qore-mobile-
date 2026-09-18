# QORE Runtime -> Mobile Gateway Telemetry Contract

Version: 0.1

This contract is for **QORE runtimes publishing supervision telemetry to QORE Mobile Gateway**. It is not a mobile trading-control API.

## Authentication

Every telemetry request is authenticated with a runtime-specific secret supplied by deployment secret management.

Required headers:

- `X-Qore-Runtime-Id: <runtime_id>`
- `X-Qore-Signature: v1=<hex HMAC-SHA256>`

The signature is HMAC-SHA256 over the **exact raw HTTP request body**.

The Gateway verifies all of the following before accepting state:

1. header runtime ID equals body runtime ID;
2. runtime is registered;
3. account ID is authorized for that runtime;
4. signature matches;
5. event sequence is valid.

No runtime secret is committed to GitHub.

## Event envelope

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

Implemented event families:

- `runtime.heartbeat`
- `account.snapshot`
- `trader.state`
- `position.opened`
- `position.updated`
- `position.closed`

Risk and alert event families remain reserved for later contracts.

## Sequence rule

Sequence is monotonic per runtime.

- first authenticated sequence may establish the runtime sequence;
- next event must equal `last_sequence + 1`;
- duplicate/older sequences are rejected;
- a forward sequence gap puts the runtime into `reconciliation_required`;
- incremental events are rejected until reconciliation succeeds.

This prevents the mobile read model from silently continuing after missing state transitions.

## Reconciliation

A runtime with a sequence gap submits a complete authenticated account scope snapshot:

- account snapshot
- all current traders for that account
- all current open positions for that account
- a new advancing sequence

Successful reconciliation atomically replaces the account scope and clears `reconciliation_required`.

## Heartbeat

A valid `runtime.heartbeat` records runtime and account heartbeat time. Freshness is derived by the Gateway, never blindly trusted from a client-provided label.

Default classification:

- LIVE: <= 5 seconds
- DELAYED: > 5 and <= 15 seconds
- STALE: > 15 and <= 60 seconds
- OFFLINE: > 60 seconds
- UNKNOWN: heartbeat absent or time invalid

## Governance

No event or reconciliation message can place, close or modify an order, alter CIBO/QORE Risk decisions or activate LIVE capital.
