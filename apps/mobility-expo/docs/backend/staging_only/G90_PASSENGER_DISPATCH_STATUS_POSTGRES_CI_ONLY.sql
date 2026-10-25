-- G90 owner-scoped dispatch UI status; NEVER deploy this disposable-only SQL
-- to a remote Supabase project. No Driver identity, offer ID or GPS is returned.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g85_auto_dispatch_jobs') IS NULL
 THEN RAISE EXCEPTION 'G90 requires disposable G85 booking SQL'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g90_passenger_dispatch_status_qa(
 _passenger_id uuid,_booking_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 r record; open_offer boolean; state text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _booking_key IS NULL
 THEN RAISE EXCEPTION 'G90 invalid private Passenger scope' USING ERRCODE='P9001'; END IF;
 SELECT t.id AS trip_id,t.status AS trip_state,j.status AS queue_status,
  j.attempts,o.status AS offer_status,o.expires_at
 INTO r FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_g73_auto_routes route
  ON route.id=q.route_id AND route.passenger_id=q.passenger_id
 JOIN public.mobility_stage_auto_demo_trips t
  ON t.id=q.trip_id AND t.request_key=q.booking_key
  AND t.passenger_id=q.passenger_id AND t.service=route.service
  AND t.origin_tag=route.origin_tag AND t.destination_tag=route.destination_tag
 JOIN public.mobility_stage_g85_auto_dispatch_jobs j
  ON j.trip_id=t.id AND j.passenger_id=t.passenger_id
  AND j.booking_key=q.booking_key
 LEFT JOIN public.mobility_stage_auto_demo_offers o
  ON o.id=j.offer_id AND o.trip_id=t.id
 WHERE q.passenger_id=_passenger_id AND q.booking_key=_booking_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 open_offer:=r.trip_state='searching' AND r.queue_status='OFFERED'
  AND r.offer_status='offered'
  AND r.expires_at>pg_catalog.clock_timestamp();
 state:=CASE
  WHEN r.trip_state<>'searching' THEN 'CLOSED'
  WHEN r.queue_status='EXHAUSTED' THEN 'SEARCH_EXHAUSTED'
  WHEN open_offer THEN 'OFFER_PENDING'
  WHEN r.queue_status IN ('WAITING','OFFERED') THEN 'RETRY_PENDING'
  WHEN r.queue_status='PENDING' THEN 'SEARCHING_DRIVER'
  ELSE 'CLOSED' END;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',_passenger_id,'bookingKey',_booking_key,
  'tripId',r.trip_id,'tripState',r.trip_state,
  'dispatchState',state,'attempts',r.attempts,
  'offerPendingAcceptance',open_offer);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)
 TO service_role;
COMMIT;
