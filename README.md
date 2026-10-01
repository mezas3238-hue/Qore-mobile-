# QORE Mobile

Official mobile supervision product for QORE Core.

## Mission

QORE Mobile gives the Owner a secure Android/iOS dashboard for supervising multiple trading accounts, runtimes and certified traders without needing to remain in front of the VPS.

The mobile product is a **supervision layer**. QORE Core remains the operational source of truth.

## Repository boundary

This repository owns:

- Android application
- iOS application
- Android home-screen widgets
- iOS WidgetKit widgets
- Mobile Gateway and public mobile contracts
- push notification presentation
- mobile authentication/session handling
- portfolio, account, trader, position and risk dashboards
- mobile CI, tests, release documentation and security controls

This repository does **not** own:

- trader methodology
- CIBO decision logic
- QORE Risk decision logic
- MT5 order execution
- trader certification
- live-capital authorization

Those remain in `qore-core`.

## Initial architecture

```text
QORE Core / MT5 runtimes
        |
        | outbound authenticated telemetry
        v
QORE Mobile Gateway
        |
        | HTTPS + realtime event stream
        v
QORE Mobile
  |- Android
  |- iOS
  |- Android widget
  |- iOS WidgetKit
  `- Push notifications
```

## Governance

- `main` is the stable product baseline.
- Development happens through feature branches and pull requests.
- Foundation work starts in `agent/qore-mobile-foundation-001`.
- Initial implementation PRs remain DRAFT until explicitly approved.
- The first product phase is read-only.
- No MT5, broker or prop-firm password may be committed or embedded in the mobile application.
- No mobile screen may imply LIVE connectivity unless the gateway has authenticated fresh telemetry.

## Current foundation

The first implementation includes:

- Flutter application shell for Android/iOS
- multi-account domain model
- read-only gateway skeleton
- REST contract
- realtime event contract
- security model
- MVP acceptance criteria
- native-widget integration plan

See `docs/` for architecture and decisions.
