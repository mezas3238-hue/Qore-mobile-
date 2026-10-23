-- G26.2 dedicated indexes for unbounded owner-only history keyset pages.
-- POSTGRESQL 16 disposable chain only. Never apply to remote Supabase.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'Refusing G26 index work outside disposable QA'; END IF;
 IF to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR to_regclass('public.mobility_stage_deliveries') IS NULL
 OR to_regclass('public.mobility_stage_merchant_orders') IS NULL
 THEN RAISE EXCEPTION 'G3+G5+G6 prerequisite tables missing'; END IF;
END $guard$;
BEGIN;
-- Only columns needed for the server-side owner-scoped, descending keyset page.
-- Include status+revision to avoid unnecessary heap fetches when visibility permits.
CREATE INDEX mobility_stage_history_rider_desc_g26
 ON public.mobility_stage_auto_demo_trips
 (passenger_id,created_at DESC,id DESC) INCLUDE(status,revision);
CREATE INDEX mobility_stage_history_delivery_desc_g26
 ON public.mobility_stage_deliveries
 (sender_id,created_at DESC,id DESC) INCLUDE(status,revision);
CREATE INDEX mobility_stage_history_merchant_desc_g26
 ON public.mobility_stage_merchant_orders
 (buyer_id,created_at DESC,id DESC) INCLUDE(status,revision);
COMMIT;
