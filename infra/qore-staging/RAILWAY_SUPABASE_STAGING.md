# QORE G229 — Railway + Supabase STAGING deployment controls

The GitHub source is the authority. This directory does **not** create cloud
resources or grant release approval. All four surfaces (Cliente B, Driver C,
Merchant staff + Admin D and the Backend A) must use **one pinned staging API
origin** and one separate Supabase project. Never use the existing production
Supabase project or import disposable PostgreSQL CI fixtures into a persistent
hosted database.

## Engineering delivered

- Backend entrypoint: `apps/mobility-expo/server/run-g4-railway-staging.mjs`.
- Reuses `prepareQoreG4StagingRuntime`, existing Supabase repositories,
  server-side RBAC, G42 session revocation, and original service IDs.
- HTTPS ingress: `railway-staging-ingress.mjs` inherits request-body limits,
  no credentials/cookies, bounded responses, pinned Host and forwarded HTTPS,
  private Admin CORS, rate/budget backpressure and same G4 loopback.
- Supported hosting host is the **exact** independently approved
  `https://<name>.up.railway.app` origin, never a URL from requests.
- POST/GET are unchanged; PUT is forwarded **only** for the G197 Driver
  `/v1/staging/driver/pickup-preferences` path and remains subject to backend
  Auth, role, session and PostgreSQL checks.
- G221 five original QA closures remain CI-only, not a deployment permit.

## Railway (intentionally no deployment)

The linked Railway account currently reports an expired trial; creating the
new STAGING project is blocked pending an account plan decision. Do **not**
change the existing `qore-mobile-gateway` production environment.

Once the Owner approves an eligible non-enterprise plan:

1. Create a **private**, isolated `qore-mobile-staging` project with its
   first environment named `STAGING`; PR environments OFF.
2. Create an empty backend service. Set root directory
   `/apps/mobility-expo` and explicit start command
   `node server/run-g4-railway-staging.mjs`; Node 22, health check
   `/_qore/liveness`. Never use the Expo default `npm start`.
3. Stage the GitHub source `mezas3238-hue/Qore-mobile-`, the reviewed
   integration candidate SHA, and all settings. Keep changes **staged**;
   do not accept/deploy. If connected live in the dashboard, explicitly
   disable GitHub automatic deployments before adding a new commit.
4. Configure `PORT` from Railway and a verified deployment domain; pin
   the exact hostname in `QORE_RAILWAY_HOSTNAME`. Do not enable a
   commercial domain, live dispatch, paid PSP or public registrations.
5. Set private variables using Railway's encrypted environment settings.
   NEVER put `QORE_STAGING_SERVICE_ROLE_KEY`, Auth private secrets,
   Geoapify server tokens or cursor-signing keys into GitHub source,
   Expo public variables or browser environment variables.

Safe base variables (all default to blocked until explicitly certified):

```dotenv
QORE_MOBILITY_ENV=staging
LIVE_TRIPS_ENABLED=false
QORE_RAILWAY_NO_COMMERCIAL_TRIPS=true
QORE_RAILWAY_STAGING_APPROVED=false
QORE_EDGE_MAX_READS=256
QORE_EDGE_MAX_WRITES=128
QORE_EDGE_MAX_IDENTITIES=32768
```

Required values at approved start: `RAILWAY_ENVIRONMENT_NAME=STAGING`
(provided by Railway), `PORT`, `QORE_RAILWAY_HOSTNAME`,
`QORE_ADMIN_BROWSER_ORIGIN`, `QORE_STAGING_PROJECT_REF`,
`QORE_STAGING_PUBLISHABLE_KEY`, `QORE_STAGING_SERVICE_ROLE_KEY`,
`QORE_HISTORY_CURSOR_SIGNING_KEY`. Set
`QORE_RAILWAY_STAGING_APPROVED=true` **only after** the project passes
Supabase Auth and security checks, and Owner authorizes STAGING start.

## Supabase persistent STAGING (created and isolated; operational flows still blocked)

**Created 31 Oct 2026** in the connected Free organization: project ref
`mrjzxftsdxzepzbcuids`, São Paulo `sa-east-1`, PostgreSQL 17.11,
provider status `ACTIVE_HEALTHY`. Cost quoted by Supabase: **USD 0/month**.
This is a brand-new test project, separate from any previous environment.
[Open Supabase STAGING](https://supabase.com/dashboard/project/mrjzxftsdxzepzbcuids).

The Owner's command to start STAGING did not authorize real payments, LIVE or
public signup. No credentials or passwords were committed to GitHub.

1. Create a **new** `qore-mobile-staging` Supabase project; keep any LIVE
   refs/keys completely separate. Disable public Auth signups, require
   email confirmation and restrict redirect URLs. The existing
   `staging-auth-policy-gate.mjs` must return PASS.
2. Review the repository's G1 isolated baseline SQL under
   `docs/backend/staging_only/G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql`.
   Do not run it automatically. Generate migration files via an approved
   Supabase CLI workflow with a reviewed schema diff, backup/rollback plan,
   app-specific RLS/grants, and explicit Owner authorization.
3. The full runtime needs the G4/G5/G6/G7/G8/G9/G10 stage schema, not
   merely G1. Existing `*_POSTGRES_CI_ONLY.sql` files include synthetic
   records, temporary permission/trigger handling and local-only assumptions:
   **NEVER** import them directly to hosted Supabase. Extract and review
   deployment-safe DDL as independent migrations first.
4. Execute `infra/qore-staging/supabase-schema-preflight-readonly.sql`
   to identify missing tables, disabled RLS and unexpected direct writes.
   No schema is certified simply because the file exists.
5. Create independent Auth users for Passenger, AUTO Driver, MOTO Driver,
   Courier, Merchant Staff, Admin/Owner and recipient testing using the
   authorized Auth admin console, with no test passwords in GitHub.
   Each role requires least privilege and RLS denial of cross-account access.
   Do not grant KYC, municipal permissions or paid-settlement status through
   synthetic SQL fixtures.

### Verified G231–G237 implementation (31 Oct 2026)

GitHub sources, in this branch under `infra/qore-staging/migrations/`:

- `g231_auth_profiles_exclusive_roles_rls.sql` — profiles, exclusive primary
  roles, self-read policies, and the Auth signup trigger (new accounts start
  as passenger; this is NOT permission to allow public signups).
- `g232_remove_elevated_role_helper_and_deny_location_reads.sql` — no
  SECURITY DEFINER role lookup, no direct GPS/location access.
- `g233_vehicle_compliance_staging_owner_only.sql` — AUTO/MOTO inventory,
  licenses/insurance/municipal verification structures without granting approval.
- `g234_private_vehicle_applications_only.sql` — private idempotent intake,
  server-only mutation authority.
- `g235_denied_kyc_compliance_data_api.sql` — explicitly deny direct
  sensitive compliance reads in exposed Data API.
- `g236_index_and_cache_rls_session_helpers.sql` — index review FKs and
  optimize role/session RLS checks for PostgreSQL planner.
- `g237_private_driver_evidence_bucket_locked.sql` — private 5-MB image
  bucket, zero uploads and zero client Storage policies.

**Provider-side verification:** seven migration-history entries, seven public
QORE tables with RLS enabled, zero Auth users, zero uploaded documents,
zero unexpected direct anon/authenticated write privileges, and **no Supabase
security-advisor notices**. No simulated test users, vehicle approvals or paid
settlements have been inserted.

**Still required before enabling external G4:** dashboard Auth public
signups must be DISABLED by an authorized operator (not togglable with the
available connector); require a verified signup-policy gate; create real
independent test identities through Supabase Auth (not SQL inserts into
`auth.users`); review and apply persistent migrations for the remaining
**29 of 32** G4 operational tables (see read-only schema preflight); certify
Supabase PostgreSQL **17** compatibility with GitHub's PostgreSQL **16** QA;
add provider session revocation/RLS integration, then stage Railway HTTPS
once the separate Railway account plan blocker is resolved. A 7/7 RLS PASS
is not a 5/5 external journey pass. Commercial remains NO-GO.

## Four application connections

Use the **same** approved Railway HTTPS origin and independent pin for
Cliente's `EXPO_PUBLIC_F1_STAGING_ORIGIN` and
`EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN`; Driver's
`EXPO_PUBLIC_QORE_STAGING_API_ORIGIN` and its pinned host/origin options;
Admin and Merchant staff's `VITE_*_STAGING_ORIGIN` and matching
`VITE_*_PINNED_ORIGIN`. The *public* Supabase URL/publishable key may be
shipped to native/web clients, but the server secret must remain in Railway.

All functional approval flags default OFF. Matching URLs and a green
`/_qore/liveness` prove only transport reachability, **not** live KYC/GPS,
payments, PostgreSQL write safety, public registration authorization,
merchant fulfilment, or 5/5 external E2E.

## Release acceptance

After separately authorized Railway + Supabase STAGING configuration,
run all five service types with independent real Auth sessions and
persistent original identifiers. Audit Admin from a separate role and
check idempotency, notification replay, disconnect/reconnect, RLS adversarial
tests, legal KYC denial, anti-fraud, financial reconciliation, and
repeatable concurrency. Never describe the G221 disposable synthetic
5/5 as external commercial readiness. No merge or LIVE deployment
without the Owner's explicit command.
