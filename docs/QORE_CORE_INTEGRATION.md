# QORE Core -> QORE Mobile Integration

Status: Foundation contract
Date: 2026-09-18

## Objective

Connect QORE Core runtimes to QORE Mobile without moving trading authority into the mobile product.

The integration direction is deliberately one-way for operational state:

```text
QORE Core runtime
    |
    | outbound HTTPS telemetry
    v
QORE Mobile Gateway
    |
    | authenticated read API
    v
QORE Mobile app/widgets
```

QORE Mobile does not connect directly to MT5 and does not send order commands back to QORE Core.

## Runtime publisher responsibilities

The future qore-core adapter must:

1. own a stable `runtime_id`;
2. know the account IDs that runtime is authorized to publish;
3. maintain one monotonic sequence per runtime;
4. serialize the request body first;
5. calculate HMAC-SHA256 over those exact bytes;
6. send the exact signed bytes over TLS;
7. handle 409 sequence responses by stopping incremental publication;
8. send a complete reconciliation snapshot before resuming incremental events.

## Authentication headers

```text
X-Qore-Runtime-Id: <runtime_id>
X-Qore-Signature: v1=<hmac-sha256-hex>
Content-Type: application/json
```

The runtime secret is deployment material. It must never be committed to either repository.

## Startup behavior

Recommended runtime startup flow:

1. establish local Core/MT5 state;
2. construct a full reconciliation snapshot;
3. publish `/v1/runtime/reconcile` with the current sequence;
4. only after 202 Accepted begin incremental events;
5. emit heartbeats continuously while the runtime is healthy.

This prevents a restarted Gateway from assuming that partial incremental state is complete.

## Incremental events

Supported foundation events:

- `runtime.heartbeat`
- `account.snapshot`
- `trader.state`
- `position.opened`
- `position.updated`
- `position.closed`

QORE Core remains responsible for deciding what the trader is doing. The mobile payload is a projection of that state, not a second decision engine.

## Sequence behavior

For a runtime whose last accepted sequence is `N`:

- `N + 1` -> accepted;
- `<= N` -> rejected as replay/out-of-order;
- `> N + 1` -> sequence gap; runtime enters reconciliation-required state.

Once reconciliation is required, ordinary incremental events remain blocked.

## Account binding

Gateway deployment configuration explicitly binds each `runtime_id` to one or more account IDs.

A correctly signed message is still rejected if the runtime tries to publish an account outside that allowlist.

## Reconciliation snapshot

A reconciliation contains the complete current scope for one account:

- account snapshot;
- every current trader on that account;
- every current open position on that account.

The Gateway atomically replaces that account scope after validation.

A reconciliation cannot reuse a trader/position identity that belongs to another account.

## Mobile freshness

Runtime heartbeat is the authoritative connectivity input.

The Gateway derives:

- LIVE
- DELAYED
- STALE
- OFFLINE
- UNKNOWN

The mobile client never gets to label itself LIVE.

## Failure handling

### Gateway unreachable

QORE Core trading behavior must not depend on QORE Mobile availability. Mobile telemetry failure is an observability failure, not a reason to mutate trader methodology.

The runtime should retain enough local sequence/state metadata to reconcile when connectivity returns.

### Authentication failure

Stop publication and raise an operational alert. Do not downgrade to unauthenticated telemetry.

### Sequence gap

Stop incremental publication and reconcile.

### Mobile app offline

No effect on QORE Core. Push/widget state may be stale and must visibly show its timestamp/freshness.

## Explicitly forbidden integration

The foundation contract contains no endpoint for:

- opening an order;
- closing an order;
- changing lot size;
- changing SL/TP;
- changing CIBO;
- changing QORE Risk;
- enabling LIVE authorization.

Any future control plane requires a new ADR, threat model and explicit Owner authorization.
