# QORE G232 — Supabase STAGING identity baseline (2026-10-31)

Project verified **ACTIVE_HEALTHY**: `qore-mobile-staging`, `mrjzxftsdxzepzbcuids`, `sa-east-1`, Postgres 17. Project created before this change; no duplicate provision.

Verified before DDL: zero `public` tables, zero Supabase migration records, zero `auth.users`, zero security advisor lints.

GitHub-authored SQL: `apps/mobility-expo/supabase/staging_sql/qore_staging_identity_baseline.sql`. Apply to **this project only** via Supabase migration tooling; `supabase/migrations/` currently contains legacy patch files dependent on missing baseline, so **DO NOT** run `supabase db push` against the whole legacy directory.

Scope: `profiles`, `user_roles` (single role, server assigned), `driver_locations` private; RLS enabled, authenticated read only own profile/role, zero anonymous grants, no native writes, no GPS exposure, no signup trigger or seeded accounts.

**Critical outstanding:** public signups must be **disabled in Supabase Auth configuration via dashboard** before creating independent test identities or launching a public client. SQL alone cannot change the Auth provider signup setting. No client is connected yet. Verify Auth `disable_signup=true` using a trusted admin check.

**Not yet installed:** 29 G4 schema tables and required RPCs, verified RLS rules for service-specific flows, order/driver/courier/merchant/Admin independent accounts, storage private docs, external persistent E2E. **Never copy `docs/backend/staging_only/*CI_ONLY.sql` directly into persistent Supabase**: QA fixture/rollback assumptions differ.

No payments, PSP, real bookings, commercial GPS or public registration. Railway production existing project remains untouched.
