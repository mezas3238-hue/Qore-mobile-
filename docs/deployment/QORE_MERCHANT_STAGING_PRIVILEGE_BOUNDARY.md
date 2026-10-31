# QORE — Merchant STAGING privilege isolation (2026-10-31)

Deploy only to Supabase `mrjzxftsdxzepzbcuids`, **never** production. Unlike G6/G9 legacy QA, this migration creates **no tables, users, fake approvals or commercial payments**.

Business logic preserves the 7 existing SQL contracts: onboarding; admin approval/suspension; branch configuration; catalog upsert; order request; order transition; attach a delivery. Defense-in-depth:
- The existing direct INSERT/UPDATE lockdown on Merchant tables remains; backend `service_role` cannot mutate them directly, even after apply.
- Privileged writes live only in `qore_stage_internal`, not exposed via Supabase Data API. Seven internal routines use `SECURITY DEFINER SET search_path=''` and explicit existing role/staff/owner validations; seven public `SECURITY INVOKER` wrappers are executable only by `service_role`.
- Merchant approval requires a real `admin` role; buyer a real `passenger` identity; staff order transitions require the merchant still approved.
- Keys/idempotency and lock-before-update protect stock/order revisions, return/refund events carry original order ID; no shortcut to grant client writes.
- Never expose `service_role` key to the four clients; only Railway HTTPS STAGING may use it.
- Public Auth signups are **not confirmed disabled** yet; independent Auth users **still absent**. None of these functions are invoked as commercial services.

**Go/no-go**: all GitHub checks must pass, verify constraints and grant tables directly in Supabase, then apply under guarded idempotent migration. External 5/5 E2E remain pending genuine independent accounts, approved test merchant, STAGING Railway service and persistent observations.
