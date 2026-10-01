# ADR 0001 — Keep QORE Mobile separate from qore-core

Status: Accepted

Date: 2026-09-18

## Context

QORE Core contains trading/runtime responsibilities. Mobile applications introduce UI frameworks, Apple/Android build systems, widget code, notification integrations and release tooling.

Mixing those concerns would increase dependency surface and create unnecessary risk around trading-core changes.

## Decision

The official mobile application, Android/iOS widgets, Mobile Gateway contracts and mobile-specific backend code live in `mezas3238-hue/Qore-mobile-`.

`qore-core` remains the trading source of truth.

## Consequences

- Mobile can evolve without adding Flutter/Swift/Kotlin dependencies to Core.
- Core can remain focused on execution/certification.
- Integration must occur through an explicit versioned contract.
- No trading methodology may be duplicated into the mobile repository.
