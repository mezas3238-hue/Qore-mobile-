-- G16: private AUTO offer discovery independent of push delivery.
-- Local PostgreSQL 16 disposable CI ONLY, after G4/G15. Never remote or LIVE.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G16 refuses non-disposable database'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_poll_driver_auto_offers(_driver_id uuid)
 RETURNS TABLE(offer_id uuid,trip_id uuid,expires_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF _driver_id IS NULL THEN RAISE EXCEPTION 'Verified driver required'; END IF;
 RETURN QUERY
 SELECT o.id,o.trip_id,o.expires_at
 FROM public.mobility_stage_auto_demo_offers o
 JOIN public.mobility_stage_auto_demo_trips t ON t.id=o.trip_id
 JOIN public.mobility_stage_auto_demo_push_outbox p ON p.offer_id=o.id
 WHERE o.driver_id=_driver_id AND p.driver_id=_driver_id
   AND o.status='offered' AND t.status='searching'
   AND t.service IN ('economico','confort','xl')
   AND t.passenger_id<>_driver_id
   AND o.expires_at>pg_catalog.clock_timestamp()+interval '3 seconds'
 ORDER BY o.offered_at,o.id
 LIMIT 5;
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_poll_driver_auto_offers(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_poll_driver_auto_offers(uuid)
 TO service_role;
COMMIT;
