-- G81: atomically bind one privately offered Driver to an existing G73
-- booked AUTO trip; no guessed client trip_id, no push delivery assertion.
-- PostgreSQL16 DISPOSABLE chain ONLY; NEVER APPLY TO REMOTE DB.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G81 isolated G73/G4/G71 chain required'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g81_offer_booked_auto(
 _passenger_id uuid,_booking_key uuid,_driver_id uuid,_vehicle_id uuid,
 _offer_key uuid,_ttl_seconds integer)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_trip uuid;v_offer uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _booking_key IS NULL
 OR _driver_id IS NULL OR _vehicle_id IS NULL OR _offer_key IS NULL
 OR _passenger_id=_driver_id OR _ttl_seconds NOT BETWEEN 5 AND 30
 THEN RAISE EXCEPTION 'G81 invalid private dispatch scope' USING ERRCODE='P8101'; END IF;
 -- The booking key is the only trip locator. Verify the persisted G73
 -- chain, owner, specific route and quote under the SAME locked trip row.
 SELECT t.id INTO v_trip
 FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_auto_demo_trips t
  ON t.id=q.trip_id AND t.passenger_id=q.passenger_id
  AND t.request_key=q.booking_key
 JOIN public.mobility_stage_g73_auto_routes r
  ON r.id=q.route_id AND r.passenger_id=q.passenger_id
  AND r.service=t.service AND r.origin_tag=t.origin_tag
  AND r.destination_tag=t.destination_tag
 WHERE q.passenger_id=_passenger_id AND q.booking_key=_booking_key
  AND t.status='searching' AND t.driver_id IS NULL AND t.vehicle_id IS NULL
 FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'G81 no owner-scoped unassigned G73 booking'
   USING ERRCODE='P8101'; END IF;
 -- The existing G71 wrapped G4 RPC validates the freshest eight-document
 -- KYC dossier and G20 AUTO preflight; G4 writes offer + outbox atomically.
 -- G38/G36 remain independent mandatory gates on eventual acceptance.
 v_offer:=public.mobility_stage_auto_demo_offer(
   v_trip,_driver_id,_vehicle_id,_offer_key,_ttl_seconds);
 IF v_offer IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_auto_demo_offers o
  JOIN public.mobility_stage_auto_demo_push_outbox box ON box.offer_id=o.id
  WHERE o.id=v_offer AND o.trip_id=v_trip AND o.driver_id=_driver_id
  AND o.vehicle_id=_vehicle_id AND o.request_key=_offer_key)
 THEN RAISE EXCEPTION 'G81 offer not durably bound to G73 booking'
   USING ERRCODE='P8101'; END IF;
 RETURN v_offer;
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g81_offer_booked_auto(
 uuid,uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g81_offer_booked_auto(
 uuid,uuid,uuid,uuid,uuid,integer) TO service_role;
COMMIT;
