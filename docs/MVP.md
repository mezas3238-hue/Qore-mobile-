# QORE Mobile MVP

## Purpose

The MVP proves that the Owner can supervise multiple QORE accounts and traders from one Android/iOS application without exposing trading execution to the mobile device.

## MVP screens

### Portfolio

Shows:

- aggregate balance
- aggregate equity
- realized P/L
- floating P/L
- daily drawdown usage
- total drawdown usage
- open risk
- number of accounts
- number of active positions
- runtime health summary

### Accounts

Each account shows:

- provider
- account label
- mode: DEMO / SHADOW / LIVE
- balance/equity
- daily P/L
- drawdown usage
- open positions
- runtime freshness
- last heartbeat

### Traders

Each trader shows:

- trader identity
- symbol/market
- account
- mode
- runtime status
- current state
- last market-read timestamp
- last signal/abstention timestamp
- position summary when present

### Positions

Each position shows:

- account
- trader identity
- symbol
- side
- entry
- current price
- stop
- target when defined
- size
- unrealized P/L
- R state when supplied by Core
- open time

### Alerts

Initial alert classes:

- runtime stale/offline
- account connection lost
- position opened/closed
- daily drawdown threshold
- total drawdown threshold
- risk lock/safe state
- authentication/security event

## Multi-account requirement

The data model must not assume one FundedNext account.

The Owner can register multiple accounts and group them by provider. New providers must not require redesigning the app domain model.

## Widget MVP

### Compact widget

- portfolio daily P/L
- portfolio equity
- portfolio drawdown
- active positions
- healthy/total runtimes

### Expanded widget

Adds per-account summary and last refresh time.

Widgets must visibly display their snapshot timestamp.

## Acceptance criteria

MVP is not accepted until:

1. Android and iOS render the same canonical account/trader state.
2. At least two accounts can be represented simultaneously.
3. An account can contain multiple traders.
4. stale telemetry is visibly different from fresh telemetry.
5. a runtime going offline creates an alert.
6. the app contains no MT5/provider password.
7. REST snapshots and realtime events reconcile after reconnect.
8. widgets show last refresh time.
9. read-only API contains no trading command endpoint.
10. automated tests cover domain parsing and freshness states.
