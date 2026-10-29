-- G177 — original G3 AUTO Driver step with independent G42 transaction.
-- Disposable PostgreSQL16 ONLY. Never migrate to LIVE or production.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_auto_demo_transition(uuid,uuid,public.mobility_stage_trip_status,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.user_roles') IS NULL
 THEN RAISE EXCEPTION 'G177 refuses non-disposable or incomplete original G3/G42 chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g177_driver_auto_step_qa(
 _driver uuid,_session uuid,_iat bigint,_trip uuid,_event text,_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE target public.mobility_stage_trip_status;
 roles integer:=0; the_role text; event_id uuid;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _session IS NULL OR _iat IS NULL
 OR _trip IS NULL OR _key IS NULL
 OR _event NOT IN ('arrive','pickup','complete')
 THEN RAISE EXCEPTION 'G177 invalid original Driver command'
  USING ERRCODE='P1771'; END IF;
 -- Source-owned role is exact; dual-role and missing-role actors cannot
 -- drive, regardless of what a client JWT might claim.
 SELECT count(*),min(role::text) INTO roles,the_role
 FROM public.user_roles WHERE user_id=_driver;
 IF roles<>1 OR the_role<>'driver' THEN
  RAISE EXCEPTION 'G177 Driver exclusive role required'
   USING ERRCODE='P1771';
 END IF;
 -- Hold original grant row through the G3 mutation COMMIT. Revocation
 -- races serialize instead of trusting an earlier HTTP token check.
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat) THEN
  RAISE EXCEPTION 'G177 source provider session revoked'
   USING ERRCODE='P1771';
 END IF;
 -- G204: require the SAME new G73 Passenger route, quoted booking and
 -- legally accepted G4 offer. An assigned G3 legacy/pre-G38 fixture can
 -- no longer complete through the integrated Driver HTTP command.
 -- Locks on the original G3 trip are acquired after the G42 session lock,
 -- in the same transaction as the original state transition below.
 IF NOT EXISTS (
  SELECT 1 FROM public.mobility_stage_auto_demo_trips t
  JOIN public.mobility_stage_g72_auto_prequotes q
   ON q.trip_id=t.id AND q.passenger_id=t.passenger_id
   AND q.booking_key=t.request_key
  JOIN public.mobility_stage_g73_auto_routes r
   ON r.id=q.route_id AND r.passenger_id=t.passenger_id
   AND r.service=t.service AND r.origin_tag=t.origin_tag
   AND r.destination_tag=t.destination_tag
  JOIN public.mobility_stage_auto_demo_offers o
   ON o.trip_id=t.id AND o.driver_id=_driver
   AND o.vehicle_id=t.vehicle_id AND o.status='accepted'
  JOIN public.mobility_stage_auto_demo_events a
   ON a.id=o.decision_event_id AND a.trip_id=t.id
   AND a.actor_id=_driver AND a.next_status='accepted'
  WHERE t.id=_trip AND t.driver_id=_driver
   AND t.status IN ('accepted','arriving','in_progress','completed')
 ) THEN
  RAISE EXCEPTION 'G204 not the original G73/G71 accepted AUTO booking'
   USING ERRCODE='P1771';
 END IF;
 target:=CASE _event
  WHEN 'arrive' THEN 'arriving'::public.mobility_stage_trip_status
  WHEN 'pickup' THEN 'in_progress'::public.mobility_stage_trip_status
  WHEN 'complete' THEN 'completed'::public.mobility_stage_trip_status
  ELSE NULL END;
 -- Original G3 checks exact assigned driver, ordered state and idempotency;
 -- G38/G71 cannot be bypassed: this function never assigns a new driver.
 event_id:=public.mobility_stage_auto_demo_transition(
  _trip,_driver,target,_key);
 IF event_id IS NULL THEN
  RAISE EXCEPTION 'G177 original G3 transition missing'
   USING ERRCODE='P1771';
 END IF;
 RETURN event_id;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g177_driver_auto_step_qa(
 uuid,uuid,bigint,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g177_driver_auto_step_qa(
 uuid,uuid,bigint,uuid,text,uuid) TO service_role;
COMMIT;
