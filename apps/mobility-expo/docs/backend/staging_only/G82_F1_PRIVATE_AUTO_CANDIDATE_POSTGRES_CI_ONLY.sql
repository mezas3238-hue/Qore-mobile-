-- G82: owner-only QA candidate discovery bound to an already booked G73 AUTO.
-- NO client supplied driver ID; no geofence proof or LIVE dispatch assertion.
-- PostgreSQL16 DISPOSABLE ONLY. NEVER APPLY TO REMOTE SUPABASE.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g81_offer_booked_auto(uuid,uuid,uuid,uuid,uuid,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 OR to_regclass('public.mobility_stage_g36_driver_slots') IS NULL
 THEN RAISE EXCEPTION 'G82 requires isolated G81/G71/G36 chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g82_offer_first_eligible_auto_qa(
 _passenger_id uuid,_booking_key uuid,_offer_key uuid,_ttl_seconds integer)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 trip_id uuid; trip_service public.mobility_service_kind;
 chosen_driver uuid; chosen_vehicle uuid;
 already public.mobility_stage_auto_demo_offers%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _booking_key IS NULL OR _offer_key IS NULL
 OR _ttl_seconds IS NULL OR _ttl_seconds NOT BETWEEN 5 AND 30
 THEN RAISE EXCEPTION 'G82 invalid private QA dispatch scope' USING ERRCODE='P8201'; END IF;
 -- Serialize retries and competing candidate selections on the G73 trip.
 SELECT t.id,t.service INTO trip_id,trip_service
 FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_auto_demo_trips t
   ON t.id=q.trip_id AND t.passenger_id=q.passenger_id
   AND t.request_key=q.booking_key
 JOIN public.mobility_stage_g73_auto_routes r
   ON r.id=q.route_id AND r.passenger_id=t.passenger_id
   AND r.service=t.service AND r.origin_tag=t.origin_tag
   AND r.destination_tag=t.destination_tag
 WHERE q.passenger_id=_passenger_id AND q.booking_key=_booking_key
 AND t.status='searching' AND t.driver_id IS NULL AND t.vehicle_id IS NULL
 FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'G82 no unassigned owner-bound G73 trip'
   USING ERRCODE='P8201'; END IF;
 -- Idempotency is scoped to the original booked trip, not the latest driver.
 -- G81/G4 recheck the original candidate and never renew an old TTL.
 SELECT * INTO already FROM public.mobility_stage_auto_demo_offers
  WHERE request_key=_offer_key;
 IF FOUND THEN
  IF already.trip_id<>trip_id OR already.ttl_seconds<>_ttl_seconds
  THEN RAISE EXCEPTION 'G82 conflicting dispatch key' USING ERRCODE='P8201'; END IF;
  RETURN public.mobility_stage_g81_offer_booked_auto(
   _passenger_id,_booking_key,already.driver_id,already.vehicle_id,
   _offer_key,_ttl_seconds);
 END IF;
 -- Eligibility is documentary + opted-in current availability ONLY.
 -- Do not use location to assert proximity, legal zone or dispatch permission.
 SELECT v.driver_id,v.id INTO chosen_driver,chosen_vehicle
 FROM public.mobility_vehicles v
 JOIN public.driver_locations l ON l.driver_id=v.driver_id
 WHERE v.vehicle_kind='AUTO' AND v.service_kind=trip_service
  AND v.review_status='approved'
  AND v.driver_id<>_passenger_id
  AND l.available=true
  AND l.updated_at>=pg_catalog.clock_timestamp()-interval '120 seconds'
  AND l.updated_at<=pg_catalog.clock_timestamp()+interval '15 seconds'
  AND NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_g36_driver_slots slot
   WHERE slot.driver_id=v.driver_id)
  AND NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_auto_demo_offers o
   WHERE o.trip_id=trip_id AND o.driver_id=v.driver_id)
  AND public.mobility_vehicle_preflight(v.driver_id,v.id,trip_service)
  AND public.mobility_stage_g71_valid_locked_dossier(v.driver_id,v.id)
 ORDER BY l.updated_at DESC,v.driver_id,v.id
 LIMIT 1;
 IF chosen_driver IS NULL THEN RETURN NULL; END IF;
 -- Revalidate atomically at G81 -> G71/G4. Offer is not an assignment.
 RETURN public.mobility_stage_g81_offer_booked_auto(
  _passenger_id,_booking_key,chosen_driver,chosen_vehicle,
  _offer_key,_ttl_seconds);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g82_offer_first_eligible_auto_qa(
 uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g82_offer_first_eligible_auto_qa(
 uuid,uuid,uuid,integer) TO service_role;
COMMIT;
