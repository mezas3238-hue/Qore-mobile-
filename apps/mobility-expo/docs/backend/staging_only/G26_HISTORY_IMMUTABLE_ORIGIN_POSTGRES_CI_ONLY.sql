-- G26.4: prevent historic keyset anomalies caused by edited event dates,
-- actor reassignment or service-side backdated INSERTs.
-- PostgreSQL 16 isolated disposable QA ONLY. DO NOT DEPLOY TO SUPABASE.
DO $guard$
BEGIN
 IF current_database() <> 'qore_disposable_chain'
 OR current_setting('application_name') <> 'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G26.4 refuses a non-disposable database'; END IF;
 IF (SELECT count(*) FROM pg_trigger
     WHERE tgname IN ('mobility_g264_trip_origin_guard',
                      'mobility_g264_delivery_origin_guard',
                      'mobility_g264_order_origin_guard')
       AND NOT tgisinternal) <> 0
 THEN RAISE EXCEPTION 'G26.4 origin guards were already applied'; END IF;
END $guard$;
BEGIN;
-- This function is called from exactly three explicit BEFORE row triggers.
-- Status/revision changes by existing atomic G3/G5/G6 RPCs remain allowed.
-- Identity, request key and creation order stay server-authored and immutable.
CREATE FUNCTION public.mobility_stage_g264_history_origin()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $guard$
DECLARE
 actor_column text := TG_ARGV[0];
BEGIN
 IF actor_column NOT IN ('passenger_id','sender_id','buyer_id')
 THEN RAISE EXCEPTION 'Unexpected origin owner parameter' USING ERRCODE='G2601'; END IF;
 IF TG_OP='INSERT' THEN
  -- CREATE DEFAULT now() = transaction_timestamp(). No backfills via the
  -- runtime service role; historical imports require a separately audited
  -- maintenance path, never the live API.
  IF NEW.created_at IS DISTINCT FROM transaction_timestamp()
  THEN RAISE EXCEPTION 'Backdated or future-dated history row rejected'
       USING ERRCODE='G2601'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id
 OR NEW.request_key IS DISTINCT FROM OLD.request_key
 OR NEW.created_at IS DISTINCT FROM OLD.created_at
 OR (to_jsonb(NEW)->>actor_column) IS DISTINCT FROM
    (to_jsonb(OLD)->>actor_column)
 THEN
  RAISE EXCEPTION 'Historic owner/identifier/time cannot be rewritten'
       USING ERRCODE='G2601';
 END IF;
 RETURN NEW;
END $guard$;

CREATE TRIGGER mobility_g264_trip_origin_guard
BEFORE INSERT OR UPDATE ON public.mobility_stage_auto_demo_trips
FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g264_history_origin('passenger_id');

CREATE TRIGGER mobility_g264_delivery_origin_guard
BEFORE INSERT OR UPDATE ON public.mobility_stage_deliveries
FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g264_history_origin('sender_id');

CREATE TRIGGER mobility_g264_order_origin_guard
BEFORE INSERT OR UPDATE ON public.mobility_stage_merchant_orders
FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g264_history_origin('buyer_id');
COMMIT;
