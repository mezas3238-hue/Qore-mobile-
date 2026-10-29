# QORE Mobile — Load Laboratory V1 (GitHub, NO LIVE)

This lab is intentionally **non-commercial** and uses the current QORE
Render staging ingress and G4 HTTP router bound to **127.0.0.1 only**.
The handler behind the route is an inert fixture. Nothing connects to real
Supabase, devices, payments, maps, GPS, Auth or users. No secrets are needed.

## Run

Node 22+ from the repository root:

    node apps/mobility-expo/scripts/load/load-lab-v1.mjs --smoke
    node apps/mobility-expo/scripts/load/load-lab-v1.mjs --stress

The stress run sends **5,500 total GET requests** in increasing
stages of 500 / 2,000 / 3,000 (25 / 80 / 120 concurrent workers).
Every request has a distinct synthetic identity, so the current
per-identity limiter cannot hide multi-user capacity saturation.
A separate 92-request same-identity probe verifies the 90/minute limiter.

Outputs:
- artifacts/qore-load-lab/results.json: per-stage HTTP status codes,
  p50/p95/p99 latency, requests/second, memory RSS, invalid responses.
- GitHub Actions step summary and downloadable artifact, even on failure.

The lab marks the step FAIL on 429/503/timeout/bad responses or p95 > 1500ms.
These are **local transport thresholds only**, not UX or production targets.
In particular, the current render-staging-ingress.mjs has an in-memory
requests.size >= 4096 guard, so stress can expose a 503 saturation point.
Changing the limit blindly is **not** a fix: a distributed limiter, queues,
backpressure and resource sizing must be designed and tested.

## Scope of evidence

| Area | V1 |
|---|---|
| Real Node ingress -> G4 HTTP routing | Tested |
| Rate limiting, timeouts, latency and overload visibility | Tested |
| PostgreSQL transactions and dispatch | NOT tested by V1 |
| Client/Driver/Admin/Commerce user actions | NOT tested by V1 |
| Auth, device GPS/push, real money and Geoapify | NOT tested |
| Multiple backend replicas, shared limiter | NOT tested |
| Render/Supabase commercial infrastructure | NOT tested |

The existing disposable PostgreSQL CI tests concurrency and database
correctness separately; neither suite may be presented as a 10,000-user
commercial E2E certification.

## V2 acceptance gate (NOT IMPLEMENTED)

Extend the load driver to original Client -> Backend -> PG16 -> Driver ->
Admin, preserving ONE trip/order identity and verifying no duplicate
assignment/payment, lost outbox item, missing status or invalid ACL.
Measure 500, 2,000 and 10,000 *simultaneously active* virtual users against
a realistically sized staging system, distinct from 5,500 sequential
requests. Add real GPS/polling mixes, queue lag, DB connections, failure
injection, multi-replica rate protection, cost budgets and p95/p99 SLOs.
Never run large tests against public production or third-party APIs.
