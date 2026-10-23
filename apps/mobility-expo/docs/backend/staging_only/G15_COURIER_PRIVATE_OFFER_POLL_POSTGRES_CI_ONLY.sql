-- G15 private courier polling fallback when push never reaches device.
-- Disposable PostgreSQL CI only, apply AFTER G10/G13. NEVER REMOTE/LIVE.
-- A push provider ticket or send_started_at is NOT necessary to discover offers.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'Refusing non-disposable G13/G15 migration'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_poll_courier_delivery_offers(
 _courier_id uuid
) RETURNS TABLE(offer_id uuid,delivery_id uuid,expires_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF _courier_id IS NULL THEN RAISE EXCEPTION 'Verified courier required'; END IF;
 RETURN QUERY
 SELECT f.id,f.delivery_id,f.expires_at
 FROM public.mobility_stage_delivery_offers f
 JOIN public.mobility_stage_deliveries d ON d.id=f.delivery_id
 JOIN public.mobility_stage_delivery_offer_outbox o ON o.offer_id=f.id
 WHERE f.courier_id=_courier_id AND o.courier_id=_courier_id
   AND EXISTS(SELECT 1 FROM public.user_roles r
      WHERE r.user_id=f.courier_id AND r.role='driver'::public.app_role)
   AND (SELECT count(*) FROM public.user_roles r
      WHERE r.user_id=f.courier_id)=1
   AND f.status='offered' AND d.status='requested'
   AND f.expires_at>pg_catalog.clock_timestamp()+interval '3 seconds'
 ORDER BY f.offered_at,f.id
 LIMIT 5;
END $fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_poll_courier_delivery_offers(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_poll_courier_delivery_offers(uuid)
 TO service_role;
COMMIT;
