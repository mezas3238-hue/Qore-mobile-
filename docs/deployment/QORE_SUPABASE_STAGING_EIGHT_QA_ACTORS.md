# QORE Mobile — Supabase STAGING eight independent QA identities

**Project PINNED** `mrjzxftsdxzepzbcuids` (2026-10-31). No LIVE. Only a **trusted operator** runs the bootstrap once from a private host. It is NOT executed on GitHub Actions. CI mocks are offline.

## Prior mandatory gate
- In Supabase Auth Providers, **disable public sign-up** on the **correct project**. Do not assume closed from an old Lovable STAGING `hylgkfgkcyrddokloljm`. The script directly checks `GET /auth/v1/settings` and requires `disable_signup=true`.
- Current Supabase MCP connector has **no Auth admin create-user endpoint and no Auth policy mutation**. The script cannot be executed here without providing private backend credentials and distinct QA passwords through a secure environment.
- Railway STAGING provisioning **currently blocked by expired trial**; no fee or plan has been selected. Existing Railway production is off limits.

## One-time steps (no emails/passwords in chat, GitHub, terminal history or CI)
1. Use secure secrets in operator runtime: `QORE_STAGING_SERVICE_ROLE_KEY` (backend ONLY), `QORE_STAGING_ANON_KEY` (publishable), `QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids`, `QORE_MOBILITY_ENV=staging`, `LIVE_TRIPS_ENABLED=false`, `QORE_QA_EXPLICIT_APPLY=CONFIRM_STAGING_ONLY`.
2. Create eight **distinct .invalid email identities** with unique long passwords in `QORE_QA_ACTORS_JSON`, in this exact slot order:
   `owner_admin:admin`, `passenger:passenger`, `driver_auto:driver`, `driver_moto:driver`, `parcel_sender:passenger`, `courier_auto:driver`, `courier_moto:driver`, `merchant_owner:passenger`. Never commit JSON values.
3. `node apps/mobility-expo/scripts/qore-staging-qa-identity-bootstrap.mjs --plan` makes zero requests; `--apply` (with those runtime envs) checks public signup OFF and **requires empty existing Auth users** before creating anything. On error stop and audit; no automated deletion.
4. Uses Auth Admin endpoint (not SQL writes to `auth.users`); existing trigger inserts `profiles` and passenger role. Service-role backend changes only the created driver's/admin's existing role from passenger to exact expected role, verifying one row each. Role assignments must be reviewed as **QA only**, not legal approvals. Test identities have no compliance certificates, GPS consent or actual vehicle approvals.
5. Run existing `staging-three-actors-readonly.mjs` after adapting pinned ref for the new project; verify cross-identity JWT and RLS. Inspect access before deployment.

Owner/Admin QA `admin` app_role is *not* a production Owner permission or automatic backoffice approval. `mobility_stage_backoffice_roles` is independently restricted. Commerce owner stays `passenger` and can only become merchant staff through the authorised (and initially pending) merchant onboarding flow.

**No commercial trips, real money, public signup, fake KYC, artificial document approvals, automatic Railway deployments, merges or production changes.** The five external E2E remain unproven until Railway STAGING + real Auth QA sessions run.

## Failure semantics
No secret, password, email, UUID or service JWT is logged. Failures stop immediately; the process does not issue deletes (which could invalidate sessions) or automatically retry after partial writes. If any Auth user already exists, the operator must audit the partial state before rerun. Real accounts or email delivery are prohibited.
