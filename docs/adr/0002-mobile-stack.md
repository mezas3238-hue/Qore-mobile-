# ADR 0002 — Flutter application with native home widgets

Status: Accepted

Date: 2026-09-18

## Context

The product needs one official application for Android and iOS plus operating-system home-screen widgets.

## Decision

Use Flutter/Dart for the shared application UI and domain layer.

Use native widget hosts where required:

- Android: Kotlin
- iOS: Swift + WidgetKit

The native widgets consume a small sanitized snapshot produced by the app/gateway integration and never receive trading credentials.

## Why

- one primary Android/iOS UI codebase
- consistent dashboard behavior
- native compliance for home-screen widgets
- clear separation between realtime app UI and OS-scheduled widget snapshots

## Consequences

Native widget targets still require platform-specific tests and release configuration.
