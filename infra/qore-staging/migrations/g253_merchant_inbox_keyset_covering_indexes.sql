-- G253 Merchant inbox top-20 read scaling on isolated Supabase STAGING.
-- Preserve original orders/actor privileges; schema and indexes ONLY.
-- G252 requires per-merchant newest orders and active membership fast path.
DO $guard$
BEGIN
 IF to_regprocedure('public.mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_merchant_orders') IS NULL
 OR (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'G253 requires isolated empty G252 Supabase staging'; END IF;
END $guard$;
CREATE INDEX IF NOT EXISTS mobility_stage_merchant_inbox_recent_idx
 ON public.mobility_stage_merchant_orders (merchant_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS mobility_stage_staff_active_user_lookup_idx
 ON public.mobility_stage_merchant_staff (user_id,merchant_id) WHERE active=true;
-- No scan of all buyers; no direct merchant DML grants, no credential or seed.
