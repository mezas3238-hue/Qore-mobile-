-- G46/A27 — fail-closed commerce privilege lockdown, disposable PostgreSQL ONLY.
-- Important: current G6/G9 SECURITY INVOKER API cannot run as service_role
-- afterwards. This is intentional until a verified JWT-bound server authority
-- with hardened private RPCs is independently certified. NO LIVE/REMOTE SQL.
DO $g46$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g45_order_receipts') IS NULL
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G46 refuses remote/incomplete merchant chain';
 END IF;
END $g46$;
BEGIN;
REVOKE ALL ON
 public.mobility_stage_merchants,
 public.mobility_stage_merchant_staff,
 public.mobility_stage_merchant_branches,
 public.mobility_stage_catalog_items,
 public.mobility_stage_merchant_orders,
 public.mobility_stage_merchant_order_lines,
 public.mobility_stage_merchant_order_events,
 public.mobility_stage_merchant_management_events
 FROM PUBLIC,anon,authenticated,service_role;

-- G6 old RPCs accept a caller-provided identity and are SECURITY INVOKER.
-- Without a JWT-bound principal there is no sound remote execute privilege.
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_request(
 uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_transition(
 uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_attach_delivery(
 uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

-- G9 merchant management is similarly NOT a trusted HTTP authority.
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_onboarding_request(
 uuid,uuid,public.mobility_stage_merchant_kind,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_review(
 uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_branch_upsert(
 uuid,uuid,uuid,text,text,integer,boolean,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_catalog_item_upsert(
 uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean)
 FROM PUBLIC,anon,authenticated,service_role;

-- Even G44 private buyer reads accept user/session UUID *parameters*: deny a
-- service token shortcut until it can attest the independently verified JWT.
REVOKE ALL ON FUNCTION public.mobility_stage_g44_buyer_branches_page(
 uuid,uuid,bigint,text,text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g44_buyer_catalog_page(
 uuid,uuid,bigint,uuid,bigint,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

-- Existing G45 receipt RPCs are already owner-only; keep them that way.
REVOKE ALL ON FUNCTION public.mobility_stage_g45_reserve_order_qa(
 uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g45_cancel_order_qa(
 uuid,uuid,bigint,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
