# QORE Mobile Architecture

## 1. Design goal

QORE Mobile must let one Owner supervise many accounts and many traders from Android and iOS while keeping trading execution isolated inside QORE Core.

The central rule is:

> Mobile observes authenticated QORE state. QORE Core decides and executes.

## 2. System boundary

### QORE Core

Source of truth for:

- market reading
- strategy identity
- CIBO
- trader experience
- QORE Risk
- position management
- MT5 execution
- account/runtime heartbeat
- operational authorization

### QORE Mobile Gateway

Responsible for:

- accepting authenticated telemetry from approved QORE runtimes
- normalizing multiple accounts into a common read model
- rejecting stale or malformed telemetry
- serving mobile REST snapshots
- publishing realtime state events
- creating notification events
- auditing device sessions and reads

The Gateway does not calculate trading signals and does not reinterpret strategy methodology.

### QORE Mobile App

Responsible for:

- portfolio overview
- account overview
- trader state
- positions
- risk display
- connectivity/heartbeat display
- alert inbox
- device authentication
- widget data presentation

## 3. Core entity hierarchy

```text
Owner
  -> Provider
      -> Account
          -> Runtime
              -> Trader
                  -> Position
                  -> Signal/Abstention state
          -> Risk snapshot
  -> Portfolio aggregate
```

An Account may host many Traders. One mobile installation may supervise many Accounts across multiple providers.

## 4. Connectivity

Initial data direction:

```text
QORE Runtime ---- outbound TLS ----> Mobile Gateway ----> Mobile App
```

The initial release is intentionally one-way for trading state. A compromised phone must not become an order-entry path into MT5.

### Freshness

Every runtime message carries:

- runtime_id
- account_id
- sequence
- event_time
- emitted_at
- schema_version

The Gateway tracks monotonic sequence and last heartbeat. Mobile views show explicit freshness states:

- LIVE: authenticated and fresh
- DELAYED: telemetry outside normal freshness target
- STALE: heartbeat expired
- OFFLINE: runtime unavailable
- UNKNOWN: state not yet established

No stale snapshot may be visually presented as current.

## 5. Realtime model

REST is used for initial snapshots and historical reads. A realtime stream carries incremental events.

Initial event families:

- runtime.heartbeat
- account.snapshot
- risk.snapshot
- trader.state
- position.opened
- position.updated
- position.closed
- alert.raised
- alert.resolved

The app reconnects and refreshes a canonical REST snapshot after sequence gaps.

## 6. Mobile stack

The shared Android/iOS application uses Flutter/Dart.

Native surfaces remain native where the OS requires them:

- Android home widget: Kotlin
- iOS widget: Swift / WidgetKit
- platform secure storage and device attestation adapters as needed

The app must not rely on a permanently running mobile process for realtime safety monitoring. Critical events are delivered through push infrastructure; opening the app obtains a fresh snapshot.

## 7. Repository layout

```text
apps/mobile/              Flutter application
gateway/                  QORE Mobile Gateway
contracts/                Versioned API/event contracts
widgets/android/          Android widget implementation
widgets/ios/              iOS WidgetKit implementation
docs/                     Architecture, security, ADRs
.github/workflows/        CI
```

## 8. Non-goals for MVP

MVP will not:

- open trades
- close trades
- change stops or targets
- alter lot sizes
- change CIBO decisions
- change QORE Risk rules
- activate LIVE authorization

Any future control plane must be separately designed, threat-modeled and approved.
