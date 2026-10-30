# QORE G231 — Railway STAGING + Supabase STAGING (NO LIVE)

**Status:** source adaptation only; no Railway service provisioned, no external Supabase project, no merge, no automatic deployment. QA PostgreSQL 16 previously 5/5 **internal**, not 5/5 external.

## Preserve existing resources

- Railway project `qore-mobile-gateway` already exists but its currently configured service uses the **production** environment and `gateway/` root on an older code branch. DO NOT overwrite, connect or deploy there.
- Create a **separate** QORE Mobile STAGING project/environment/service after owner approves costs; the Railway environment MUST be exactly named `staging`.
- Railway configuration source is `apps/mobility-expo/railway.json` with root directory `/apps/mobility-expo`, app start `node server/run-g4-railway-staging.mjs`. Railway's legacy Config-as-Code is deprecated in favor of Railway Infrastructure-as-Code; migrate before 2026-12-01 if required.
- Initial GitHub source attachment must be staged only, **not** deployed and with continuous/auto-deploy disabled. Connecting GitHub normally triggers a build immediately: never use an unstaged source connection.

## Mandatory Railway STAGING environment variables (secret values ONLY in platform)

```text
QORE_MOBILITY_ENV=staging
LIVE_TRIPS_ENABLED=false
QORE_RAILWAY_STAGING_APPROVED=true   # only after Owner authorizes a PRIVATE STAGING startup
QORE_RAILWAY_NO_COMMERCIAL_TRIPS=true
QORE_RAILWAY_HOSTNAME=<actual-unique-service>.up.railway.app
QORE_STAGING_PROJECT_REF=<Supabase project ref>
QORE_STAGING_PUBLISHABLE_KEY=<Supabase publishable key>
QORE_STAGING_SERVICE_ROLE_KEY=<server-only Supabase secret>
QORE_STAGING_READINESS_KEY=<separate random 48-128 char operator credential>
QORE_HISTORY_CURSOR_SIGNING_KEY=<separate high entropy signing secret>
QORE_ADMIN_BROWSER_ORIGIN=<exact trusted HTTPS Admin origin, optional>
PORT=<Railway-injected integer TCP port>
RAILWAY_ENVIRONMENT_NAME=staging   # injected by Railway, never manually fake in production
```

Never set `service_role` in EXPO_PUBLIC_, VITE_, a mobile bundle, browser, logs or GitHub Secrets exposed to PRs. All four applications use the same **public** Supabase Auth project and the same HTTPS G4 gateway; backend-only keys stay in the Railway service.

## Supabase STAGING prerequisites (not satisfied by current migrations)

1. Create a **new** Supabase project in the selected organization after showing owner the project's quoted cost. Never reuse LIVE. No project currently exists in the connected Supabase account.
2. Disable public signups in Supabase Auth, confirm independently using Auth admin settings, create separate Auth identities for: passenger AUTO, passenger MOTO, Driver AUTO, Driver MOTO, courier, commerce customer, merchant staff, Admin Owner. Assign verified roles **server-side**, never from user-editable JWT metadata; no shared session between actors. KYC/road/GPS/legal approval are not substituted by QA.
3. Audit the baseline before applying ANY SQL: `docs/backend/staging_only/G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql` is a prototype; the two files in `supabase/migrations/` are **patches assuming preexisting tables/functions**, not bootstrapping migrations. Do not deploy the `CI_ONLY` scripts — many use disposable fixtures or special test guards.
4. Construct reviewed, dependency-ordered **real STAGING** migrations for the G4 required tables and RPCs. Enable RLS on every exposed table; restrict `anon` and `authenticated`, use scoped server-side role assignment, and audit `SECURITY DEFINER` EXECUTE grants. Verify SQL metadata and Supabase Security Advisor; no `GRANT ALL` or wildcard RLS policies to untrusted clients.
5. Prove the same trip/order identifiers through 5 persistent external staging journeys with independently authenticated actors and immutable Admin/ledger receipts, then test failures, concurrency, idempotency and load. No automated billing or public bookings.

## Health and commercial fences

- `GET /_qore/liveness`: process only, **not** Auth, DB or E2E.
- `GET /_qore/readiness`: only a private operator credential `x-qore-readiness-key`, single pinned HTTPS host. Even status 200 means **INFRASTRUCTURE_READY_ONLY**.
- `LIVE_TRIPS_ENABLED=false`; no PSP, real payment, driver GPS broadcast or public registrations.
- Keep Render startup and its separate authorization gates unchanged. Test the Railway adapter in GitHub CI before any external action.
