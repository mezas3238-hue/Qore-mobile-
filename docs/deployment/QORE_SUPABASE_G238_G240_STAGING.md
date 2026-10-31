# QORE Supabase STAGING G238-G240

Authoritative target: `qore-mobile-staging` / `mrjzxftsdxzepzbcuids`, `sa-east-1`, PostgreSQL 17. The 7 G231-G237 migrations already exist; do not duplicate or reset them.

## Exact migration order

1. `g238_verified_driver_preflight.sql`: private driver location-consent record, service-only eligibility function (driver/vehicle/license/inspection/insurance/municipal evidence, opted-in recent GPS). MOTO passenger preflight remains **false**.
2. `g239_private_auto_original_identity.sql`: original-id AUTO QA trip + event tables, passenger-scoped authenticated READ, no native WRITE, service-only. **Direct acceptance is revoked even from service_role.**
3. `g240_private_auto_offer_fence.sql`: private offers + push outbox, decision idempotency and single trip-row lock; only service-role may call offer/decline/accept functions, no direct acceptance.
All three were ported, guarded and reviewed from disposable PostgreSQL CI contracts. **Do NOT deploy the original files marked CI_ONLY.**

Before running each step, check that prerequisites are present and no other architect has installed it; stop rather than overwrite. Re-verify on Supabase PostgreSQL 17 via pg_catalog/pg_policies/privileges and run Security Advisor. No synthetic Auth users, license approvals, consent, GPS or money are created.

**NOT YET:** whole 29-table G4 schema, further delivery/merchant/finance flows, native sessions, independent App Admin identities, legal/GPS/mapping approval, external E2E certification. Supabase Auth public signup setting must be independently verified OFF. LIVE, PSP, real commercial trips and public registrations remain disabled. No merge without user order.
