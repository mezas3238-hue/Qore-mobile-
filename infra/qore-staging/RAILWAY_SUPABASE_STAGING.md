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

## Railway — isolated STAGING exists, NOT DEPLOYED (31 Oct 2026)

Railway is now active. Provider inventory confirms project `qore-mobile-staging`
(`f0afe535-a398-41bf-b8cc-918dcf108667`), environment `staging`
(`19682286-3b2f-40ec-8768-65faeefe6cc8`). The original
`qore-mobile-gateway` project has **not** been touched.

**Concurrent configuration warning:** two different empty Railway backend
services were created in this staging project. Do not deploy or auto-enable
both:

- `qore-mobile-g4-staging-backend` (`57ff062d-72db-4f40-88f7-facd38b3a3ec`):
  its pending configuration pins the audited GitHub branch
  `agent/qore-g229-railway-supabase-staging-20261030` at reviewed
  `932d3627caff5998cacda932532e81420664f9cc`, root
  `/apps/mobility-expo`, start command
  `node server/run-g4-railway-staging.mjs`, and default-closed STAGING
  variables. A Railway staging domain exists but has **no deployed backend**.
- `qore-mobile-backend-staging` (`c00a1f8a-4b03-4e39-9264-9aad74d0bb10`):
  second service concurrently created; its GitHub source is also staged but
  it is **not** the vetted backend service and has no runtime start command
  proven. Keep unlaunched and reconcile duplicative resources before deploying.

All settings/source changes are **STAGED ONLY** in Railway patch
`20f3ba98-3351-4095-b247-ec1f883d8f6e`; there are still **zero
backend deployments**. Do not call accept-deploy yet. This patch is shared
with other architects and must be re-inspected immediately before approval.

Remaining P0 before STAGING boot: independently disable/verify Supabase
Auth public signup; provision and validate 8 Auth QA accounts via PR #55;
configure private `QORE_STAGING_SERVICE_ROLE_KEY` and a unique private
`QORE_HISTORY_CURSOR_SIGNING_KEY` inside the **server environment only**;
review pinned hostname/HTTPS, PORT and health; keep
`QORE_RAILWAY_STAGING_APPROVED=false` until positive security gates.
**No automatic deployments, LIVE dispatch, real PSP, or production merge**.

Earlier planning steps, now partially complete:

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

### Verified G231–G245 implementation in provider STAGING (31 Oct 2026)

Source-controlled migrations: `infra/qore-staging/migrations/`, all committed
first to [PR #47](https://github.com/mezas3238-hue/Qore-mobile-/pull/47),
then applied by Supabase migration tools to project
`mrjzxftsdxzepzbcuids`, PostgreSQL **17.11**.

- **G231–G237:** Auth profiles, exclusive native roles, owner-scoped reads,
  vehicle applications/compliance, denied GPS and sensitive KYC reads,
  provider performance indexes; private KYC Storage bucket locked.
- **G238:** original AUTO passenger G3 / private offer G4 **structural DDL**
  (4 tables: trip, events, offers, push outbox).
- **G239:** original delivery G5 / courier private offer G10 structure
  (5 tables: clearance, delivery, events, offers and push outbox).
- **G240:** commerce G6 / G9 catalog, independent staff, merchant branches,
  original orders, lines, events and merchant management (8 tables).
- **G241:** G7 pricing, customer quotes, *simulated-only* payment statuses,
  operations and immutable ledger structure (5 tables; NO real PSP).
- **G242:** G8 safety incidents, events, suspensions and suspension audit
  (4 tables; no real emergency responder integrations).
- **G243:** G17/G18 private driver document registry, decisions and enrollment
  (3 tables; no actual approved licenses).
- **G244:** preserves the stronger G46 deny-by-default fence: generic
  `service_role` loses commerce INSERT/UPDATE/DELETE; authenticated merchant
  may SELECT only OWN active staff association. No unsafe G6/G9 RPCs installed.
- **G245:** separate Admin vs Owner backoffice authority registry with RLS,
  service-role read only, no self-approval and no bootstrapped privileged user.

These files extract **only table/type/index structures** from the disposable
GitHub SQL definitions. They intentionally exclude CI-only guards, functions,
synthetic Auth identities, temporary roles, and synthetic service fixtures.
No write path is declared certified by this schema-only migration.

**Supabase verification from committed read-only `g246_core_schema_security_readiness_readonly.sql`:**
`32/32` G4 required tables present, `32/32` RLS enabled,
`0` anonymous access grants, `0` direct authenticated write grants,
`0` commerce generic server write grants, `0` real Auth users,
`0` sensitive Storage upload policies and `0` operational G3/G4/G5/G6/G7
transactional RPCs from the inspected key list. **15 migrations created by this PR**, with **37 tables in its original scope**
including compliance and backoffice roles. During the final verification,
a separate concurrent migration `qore_private_driver_consent_preflight_20261031`
created `public.mobility_location_consents` (zero rows, RLS enabled,
no `anon` or `authenticated` grants). The provider therefore currently
reports **16 total migration entries and 38 tables**. This separate change was
not overwritten or adopted as our migration.

Security Advisor's newly observed single **INFO** finding is
`rls_enabled_no_policy` for that concurrent consent table; absence of
client grants and RLS means it is closed to anonymous/authenticated clients,
but the other author should document/verify intended policies before enabling
its API. Our own G231–G245 tables have no Security Advisor findings.

**Outstanding P0 items for external five-service E2E:**

1. Owner to disable public self-signup in Supabase Auth dashboard and verify
   the resulting provider setting before provisioning independent test accounts;
   this connector does not expose Auth configuration or Admin create-user.
   The Auth signup trigger currently defaults to passenger; Admin and Owner
   accounts must remain distinct from native passenger/Driver roles and require
   a reviewed privileged provisioning path. Do NOT write directly into
   `auth.users`, self-grant admin, or use synthetic OAuth sessions.
2. Implement, migrate and test **real G42 provider-backed session revocation,
   admission gates, signed offer acceptance, custody proof G67/G187,
   merchant transaction G150, immutable finance G93 and Admin G138/G146**
   using the existing code. CI functions have synthetic identities/guards:
   do NOT transplant them wholesale as privileged Supabase RPCs.
3. Retest actual PostgreSQL **17** semantics separately from existing
   GitHub PostgreSQL **16** disposable CI; run true independent Auth/RLS
   positive and negative session checks, original ID tracing and financial
   reconciliation. Structural `32/32` is NOT functional 5/5.
4. Railway STAGING new project cannot yet be started: Railway trial expired,
   and a plan change requires Owner authorization. No automatic deployment,
   LIVE trips or PSP charges are permitted.

Status: `SUPABASE_REAL_SCHEMA_32_OF_32_RLS_PASS` /
`REMOTE_OPERATIONAL_RPCS_NOT_INSTALLED` /
`EXTERNAL_FIVE_E2E_0_OF_5` /
`COMMERCIAL_NO_GO`. GitHub PR #47 remains DRAFT; no merge.

### G247 Supabase Auth session boundary — applied and CI checked

- GitHub migration `g247_supabase_g42_provider_session_lock.sql` actually
  applied to STAGING Supabase PG17: `public.mobility_stage_g42_session_active`
  and `public.mobility_stage_g42_lock_session`. Public wrappers are
  `SECURITY INVOKER`; privileged reads/row locks of `auth.sessions` and
  `auth.users` are limited to internal `qore_private` functions.
- Only `service_role` may call these two public wrappers; `anon` and
  `authenticated` have no EXECUTE. An unknown/NULL user or session returns
  `false`. A SQL transaction calling the lock function can hold a row lock
  across its own protected mutation; calling it in a separate RPC does NOT
  lock another transaction, and must never be described as doing so.
- `g247-supabase-provider-session-trust.mjs` requires the provider's
  independently verified `auth.getUser(bearer)`, signed token subject and
  session ID consistency, expiration and recheck of original provider
  session in PostgreSQL. Its five Node test groups are included in
  **STAGING Node contracts** / unified GitHub CI. It is **NOT automatically
  activated** in Railway or the G187/Driver gateway before separate account,
  G42 integration and acceptance tests. The mock provider in unit tests is
  not proof of actual user sign-in.
- Concurrent independently authored migrations have also appeared in this
  same STAGING database for AUTO request/offer, courier offers and simulated
  finance. They are **not** part of G247 and no RPC is certified for LIVE.
  Recheck migration history, function grants and current GitHub HEAD before
  work to avoid overwriting any parallel architect.
- Supabase Security Advisor retains one unrelated **INFO** notice for the
  consent table with RLS enabled/no policies; its Data API has no anonymous
  or authenticated grants. Do not claim `0` total advisor notices.

G247 therefore establishes a verified **negative security boundary** on
actual PG17 and tests an independent provider-signature contract. Positive
external Client/Driver/Merchant/Admin sessions and five service journeys are
still **0/5 certified**. Railway trial/plan and Supabase Auth registration
configuration remain external gates. No public signup, LIVE or PSP authorization.

### G251–G252 — real Merchant inbox, session-bound and read-only (31 Oct 2026)

- G251 repairs TWO original HTTP gateways in-place: `G156` merchant inbox
  and `G173` mutation check. Every pre/post-operation G42 revocation now
  receives **the original signed JWT `tokenIatMs`** as well as `at`; tests
  reject missing/mismatched values, revoked pre-operation access and
  mid-operation revoke being misreported as successful completion.
- G252 adds `g252_private_merchant_inbox_provider_session.sql`, committed
  first to this draft branch and applied to the existing Supabase project.
  It installs exactly ONE `SECURITY INVOKER` public RPC
  `mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)`.
  Only `service_role` may EXECUTE. RLS and the existing G244 locked
  commerce table privileges remain unchanged: no direct anonymous/member
  table writes or public merchant-data reads.
- The read-only RPC checks the ACTUAL provider-backed G247 `auth.sessions`,
  the actor's active merchant staff association and an approved merchant;
  returns at most 20 original orders, with existing immutable order IDs,
  authoritative status/revision/totals/line quantity. It never returns
  buyer contact information, creates orders, or changes status.
- Verified against Supabase PG17: public function is `SECURITY INVOKER`,
  `service_role` EXECUTE true, anon/authenticated EXECUTE false,
  nonexistent session rejected with `G252 merchant inbox not authorized`,
  zero Auth users and zero Commerce orders. A positive independent
  real-authenticated Merchant test is **not yet possible**.
- `g4-staging-runtime.mjs` and Railway STAGING entrypoint have a second
  opt-in flag `QORE_G252_MERCHANT_INBOX_APPROVED=true` (default false).
  On opt-in the original G156 gateway uses the SAME G247 Supabase Auth
  `getUser` plus PG session check. It **DOES NOT** enable the G173
  merchant mutation flow, which retains its independently required
  session/permission/transaction fence. This is strictly read-only.
- **No provisioning / no external 5/5:** Auth public signup still needs
  owner-side disablement, real independent accounts do not yet exist,
  and Railway external STAGING is not running. PR47 remains DRAFT;
  no merge, LIVE ride, production PSP or automatic deployment.


### G254–G255 — external IdP identity and same-original-source evidence (31 Oct 2026)

- **G254**: `apps/mobility-expo/scripts/g254-eight-actor-qa-readonly-audit.mjs`
  is an EXECUTABLE, secret-redacting, read-only audit. It pins project
  `mrjzxftsdxzepzbcuids`, requires `LIVE_TRIPS_ENABLED=false` and
  `disable_signup=true` confirmed from Supabase Auth. It verifies
  **exactly eight** QA-created `.invalid` Auth users with distinct
  `app_metadata.qore_qa_slot`, confirmed email and exactly eight
  independently stored `user_roles` (1 admin / 4 driver / 3 passenger).
  It does not prove successful password login, G42 signed sessions or
  certify any external service journey. It never creates identities.
  The new `.github/workflows/qore-g254-eight-actor-readiness-contract.yml`
  executes regression tests using only mocks and **no Supabase secrets**.
  Actual audit is operator-executed `node
  apps/mobility-expo/scripts/g254-eight-actor-qa-readonly-audit.mjs --audit`
  with the *private STAGING backend* `QORE_STAGING_SERVICE_ROLE_KEY` and
  publishable `QORE_STAGING_ANON_KEY`. No credentials or manifest in GitHub.
- PR #55 separately implements the guarded eight-user Auth Admin **bootstrap**,
  but has NOT run: direct Supabase PG17 inspection found 0 `auth.users`,
  0 `auth.sessions`, and 0 `user_roles`. Do not present PR #55 or
  G254 mock tests as successful external IdP login. It is a different draft
  branch; do not overwrite it or impersonate operator-side Auth signup settings.
- **G255**: `infra/qore-staging/g255_five_original_journeys_external_evidence_readonly.sql`
  runs on the **actual Supabase STAGING PG17**. Its last execution returned:
  AUTO passenger **0**, MOTO passenger **0**, AUTO delivery **0**,
  MOTO delivery **0**, COMMERCE **0** persisted original-source rows;
  zero terminal/assigned/linked source rows, zero source events,
  zero active backoffice and zero ledger entries. All twelve inspected
  structural SQL RPCs were registered, but this alone proves NO operational
  legal authority, cross-app HTTP, external JWT session or Admin reconciliation.
  A future external QA completion requires **same original IDs in the
  actual PostgreSQL source** plus independent signed actor access and
  admin audit; the read-only query must be rerun for evidence, with
  real E2E certificates collected separately.
- Railway inspection: only the historical `qore-mobile-gateway` **production**
  environment exists, with removed historical deployments. Do not
  redeploy/repurpose it. Railway trial/plan is not authorized for spending.
  There is no independent QORE STAGING service in Railway yet.

All of the above remain **NO MERGE / NO LIVE / NO PSP / NO PAID PLAN / NO
EXTERNAL 5/5 CLAIM**. No SQL writes were required by G254 or G255.

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
