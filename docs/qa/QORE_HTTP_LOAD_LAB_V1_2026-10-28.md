# QORE Mobile — Load Laboratory V1 (GitHub, NO LIVE)

This lab is intentionally **non-commercial** and uses the current QORE
Render staging ingress and G4 HTTP router bound to **127.0.0.1 only**.
The handler behind the route is an inert fixture. Nothing connects to real
Supabase, devices, payments, maps, GPS, Auth or users. No secrets are needed.

## Run

Node 22+ from the repository root:

    node apps/mobility-expo/scripts/load/load-lab-v1.mjs --smoke
    node apps/mobility-expo/scripts/load/load-lab-v1.mjs --stress

The extended stress run sends **15,500 total GET requests** in increasing
stages of 500 / 2,000 / 3,000 / 10,000 (25 / 80 / 120 / 200 concurrent
workers). These are cumulative distinct identities within one minute,
**not 15,500 concurrent active users**. The prior 5,500-request baseline
is preserved in the first three stages.
Every request has a distinct synthetic identity, so the current
per-identity limiter cannot hide multi-user capacity saturation.
A separate 92-request same-identity probe verifies the 90/minute limiter.

Outputs:
- artifacts/qore-load-lab/results.json: per-stage HTTP status codes,
  p50/p95/p99 latency, requests/second, memory RSS, invalid responses.
- GitHub Actions step summary and downloadable artifact, even on failure.

The lab marks the step FAIL on 429/503/timeout/bad responses or p95 > 1500ms.
These are **local transport thresholds only**, not UX or production targets.
In particular, the original render-staging-ingress.mjs had a full identity-map scan on each
request and a 4,096-identity ceiling: GitHub run 40803709892 returned 1,405
HTTP 503 responses in stage 3. The fixed-window accounting now prunes only
expired oldest buckets (amortized O(1)), permits up to 16,384 distinct
active tokens per 60 seconds with bounded memory, and returns explicit 429
when that QA ceiling is reached without evicting still-active identities.
Ingress also reserves separate in-flight budgets for 256 reads and 64 POSTs;
when exhausted, 503 is an intentional immediate overload response **before**
G4/SQL, not successful request processing. Existing identities retain their
per-token 90/minute quota. The 5,500-request rerun 40804248568 passed
all 5,500 with HTTP 200 and p95 under 56 ms at the worst stage.

These numbers are per local process. **No distributed limiter, shared queue,
Autoscaling, connection pool or real PostgreSQL load is certified**. Merely
raising an in-memory limit would not make Render/Supabase horizontally safe.

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
