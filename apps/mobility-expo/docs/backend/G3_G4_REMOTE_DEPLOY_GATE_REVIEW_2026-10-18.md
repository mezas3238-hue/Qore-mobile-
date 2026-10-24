# G3/G4 remote deployment gate — 2026-10-18

Status: **NO-GO for remote SQL installation** until migration review and staging evidence. This is an engineering gate, not a claim that migration was applied.

## Verified repository inventory

- G3 trip contract: `docs/backend/staging_only/G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql` (explicit CI-only, do not apply remotely).
- G4 private offers: `docs/backend/staging_only/G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql` (explicit CI-only, do not apply remotely).
- G4 push claim: `docs/backend/staging_only/G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql` (explicit CI-only, do not apply remotely).
- G4 runtime `server/g4-staging-runtime.mjs` requires four staging tables and native Auth disable_signup=true before opening loopback.
- Existing Supabase migration folder contains P0 lockdown and private license MIME migrations only. **No approved G3/G4 remote migration** is present.
- Manual Android screenshots show V3 PASS for driver A/B, but 0 vehicle/requests rows. They do not establish cross-owner RLS on populated tables or Storage object isolation.

## Preconditions for a remote STAGING deployment

1. Independently confirm staging project reference, locked Auth signup, no production data, no live trips, no external payments, and verified service key only on a trusted server.
2. Perform a read-only catalog/schema/privilege inventory; compare G1/G2 installed objects with exact G3/G4 dependencies, including roles, enums, function signatures, GRANTs and RLS. No blind replay of CI SQL.
3. Produce separate reviewed idempotent STAGING migration(s) with explicit preflight assertions, least-privilege grants, transaction safety and reversal plan; confirm backup/recovery procedure. Require owner approval before remote writes.
4. Run disposable PostgreSQL CI plus adversarial tests: two simultaneous acceptances, replay, expired offer, unauthorized driver, dual-role admin, stale GPS, and outbox concurrency. Confirm no customer identifiers or credentials in logs.
5. After approved migration, run read-only postchecks on staging tables, RLS and RPC privileges. Then perform synthetic three-account JWT cross-owner read/write-denial tests and private Storage tests with cleanup.
6. Only after the above may a trusted staging API be deployed. Current G4 listener is loopback-only; do not expose it to phones or Internet. Use TLS, private session validation, distributed rate limiting, and server-only secrets in a separately reviewed deployment.

## Latest code gates

- QORE Radar route matrix now batches 20 driver origins and limits private offers to five.
- G4 runtime rejects a driver who also holds an admin role (must have exactly one driver role).
- Latest branch CI for this role fix passed at commit `99bcac1d65d44723d60bb20d723754536d427826` (two successful workflow runs); an earlier intermediate commit failed before its test adaptation.

**Non-negotiable:** LIVE_TRIPS_ENABLED=false, PR #7 draft, no MOTO commercial, no Flutter trading modifications.
