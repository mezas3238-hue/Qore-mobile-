-- G205: new G73 AUTO Passenger booking -> original G4 private Driver offer
-- -> atomic G42 session and G38/G71 legal acceptance. QA PostgreSQL16 ONLY.
-- Never treat synthetic KYC/zone fixtures as commercial legal clearance.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g72_auto_prequotes') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
 THEN RAISE EXCEPTION 'G205 requires disposable G73/G42/G38/G71 acceptance chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g205_accept_original_auto_qa(
 _driver uuid,_session uuid,_iat bigint,_offer uuid,_decision uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 roles_count integer; role_name text; trip_id uuid; event_id uuid;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _session IS NULL OR _iat IS NULL
 OR _offer IS NULL OR _decision IS NULL
 THEN RAISE EXCEPTION 'G205 unverified private acceptance'
  USING ERRCODE='P2051'; END IF;
 SELECT count(*),min(role::text) INTO roles_count,role_name
 FROM public.user_roles WHERE user_id=_driver;
 IF roles_count<>1 OR role_name<>'driver' THEN
  RAISE EXCEPTION 'G205 exclusive Driver required' USING ERRCODE='P2051';
 END IF;
 -- Session row locked until the accept COMMIT; revocation and acceptance
 -- serialize. The token's session/iat must come from independent G42 IdP,
 -- never the Driver POST body.
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat) THEN
  RAISE EXCEPTION 'G205 revoked Driver session' USING ERRCODE='P2051';
 END IF;
 -- This is the SAME G73 accepted quote/trip and this Driver's private offer.
 -- No legacy G3 assignment, client-generated trip or foreign booking joins.
 SELECT t.id INTO trip_id
 FROM public.mobility_stage_auto_demo_offers o
 JOIN public.mobility_stage_auto_demo_trips t ON t.id=o.trip_id
 JOIN public.mobility_stage_g72_auto_prequotes q
  ON q.trip_id=t.id AND q.passenger_id=t.passenger_id
  AND q.booking_key=t.request_key
 JOIN public.mobility_stage_g73_auto_routes r
  ON r.id=q.route_id AND r.passenger_id=t.passenger_id
  AND r.service=t.service AND r.origin_tag=t.origin_tag
  AND r.destination_tag=t.destination_tag
 WHERE o.id=_offer AND o.driver_id=_driver
  AND o.vehicle_id IS NOT NULL AND t.passenger_id<>_driver
  AND ((o.status='offered' AND t.status='searching')
    OR (o.status='accepted' AND o.decision_key=_decision
      AND t.status IN ('accepted','arriving','in_progress','completed')))
 LIMIT 1;
 IF trip_id IS NULL THEN
  RAISE EXCEPTION 'G205 original G73 booked offer unavailable'
   USING ERRCODE='P2051';
 END IF;
 -- G71 validates the freshest eight documents; G38 validates legal/zone
 -- proof and location; G36 prevents competing AUTO/DELIVERY active slots.
 -- SQL owns the one-winner and same-key idempotency; no bypass in JS.
 event_id:=public.mobility_stage_auto_demo_accept_offer(_offer,_driver,_decision);
 IF event_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_auto_demo_trips t
  JOIN public.mobility_stage_auto_demo_offers o ON o.trip_id=t.id
  JOIN public.mobility_stage_auto_demo_events e
   ON e.id=o.decision_event_id AND e.trip_id=t.id
   AND e.actor_id=_driver AND e.next_status='accepted'
  WHERE t.id=trip_id AND t.driver_id=_driver AND t.vehicle_id=o.vehicle_id
   AND t.status IN ('accepted','arriving','in_progress','completed')
   AND o.id=_offer AND o.driver_id=_driver AND o.status='accepted'
   AND o.decision_key=_decision AND o.decision_event_id=event_id
 ) THEN
  RAISE EXCEPTION 'G205 committed offer/trip provenance mismatch'
   USING ERRCODE='P2051';
 END IF;
 RETURN event_id;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g205_accept_original_auto_qa(
 uuid,uuid,bigint,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g205_accept_original_auto_qa(
 uuid,uuid,bigint,uuid,uuid) TO service_role;
COMMIT;
