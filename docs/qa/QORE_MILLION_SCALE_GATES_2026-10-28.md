# QORE Mobile million+ capacity contract

**GOAL ONLY — NO LIVE, NO DEPLOY, NO COMMERCIALLY CERTIFIED CAPACITY.**

Owner's requirement is more than 1M registered customers and an architecture
that can evolve to 1M simultaneous connected actors, without rebuilding.
Different dimensions must be tested independently: registrations stored,
authenticated concurrent connections, and concurrent business operations.

## Validated finding from PR #21

First localhost HTTP ingress stress: of 5,500 requests (120 maximum workers),
4,095 returned 200 and 1,405 returned 503 due to the current
single-instance 4,096-bucket in-memory identity guard.
Fix with an actual **distributed rate limiter/admission layer** and test
multi-instance fairness; simply increasing this constant is not an engineering
solution. Existing staging retry dispatch (G113), SQL race tests, and
31,200-row history tests are not a commercial million-user demonstration.

## Architecture required

1. Stateless horizontal backend replicas; distributed admission and overload
   control, shared limit state, autoscaling, service-level metrics.
2. PostgreSQL connection pooling, index profiling on multi-million-row data,
   appropriate partition/archival policy, read replicas, backup/restore drills.
3. Durable multi-worker dispatch with transactional outbox, leases, fairness,
   idempotency and dead-letter/reconciliation handling.
4. GPS/presence real-time transport with adaptive sampling and backpressure.
   Five-second polling by 200k connected drivers alone means ~40k polls/s.
5. Five real service journeys on the SAME persistent request across Client,
   Backend, Driver/Courier/Merchant and Admin; no double acceptance, payment
   or loss on retries and crashes; real rating and antifraud controls.
6. Regional resilience, failover, reconnect storms, p95/p99, queue lag,
   5xx, RPO/RTO, costs and explicit provider quota approvals.

## Tiered realistic certification, NOT a passed test

| Tier | Records in disposable PostgreSQL | Simultaneously connected actors |
|---|---:|---:|
| A | 100,000 | 500–2,000 |
| B | 1,000,000 | 10,000 |
| C | 2,000,000+ | 100,000 |
| D | 5,000,000+ | 500,000 |
| E | 10,000,000+ | 1,000,000 |

Higher tiers require representative distributed staging infrastructure and
a controlled load farm; GitHub's single hosted runner is not proof of 1M
sockets. Keep simulated maps/payment/push away from external providers.

The new Node model outputs hypothetical RPS using explicitly documented
assumptions and a JSON evidence artifact; it does NOT exercise PostgreSQL,
actual registered users or commercial traffic. Production GO is forbidden
until full connected E2E and sustained load benchmarks pass.
