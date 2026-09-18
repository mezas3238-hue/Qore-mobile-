# ADR 0003 — Read-only mobile control plane for MVP

Status: Accepted

Date: 2026-09-18

## Decision

QORE Mobile MVP is read-only with respect to trading execution.

It may display state and receive alerts but may not:

- place an order
- close an order
- modify SL/TP
- change position size
- change QORE Risk authorization
- change CIBO decisions
- activate LIVE capital

## Rationale

The phone is a high-exposure endpoint. Supervision provides immediate value without introducing a new execution authority.

Any future administrative controls require a separate ADR, threat model, authorization design and explicit Owner approval.
