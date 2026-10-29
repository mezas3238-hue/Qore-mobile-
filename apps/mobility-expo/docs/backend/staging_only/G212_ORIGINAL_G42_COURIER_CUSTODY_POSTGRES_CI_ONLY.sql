-- G212 — G42-locked original courier pickup/deliver/return for AUTO,
-- MOTO and Commerce-linked G5 deliveries. CI-disposable PostgreSQL16 only.
-- No KYC, GPS, recipient proof or external PSP is invented here.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_delivery_offers') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g122_delivery_price_consents') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g67_delivery_proofs') IS NULL
 THEN RAISE EXCEPTION 'G212 requires disposable G5/G10/G42/G67/G122 original chain'
  USING ERRCODE='P2120'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g212_courier_custody_step_qa(
 _driver uuid,_session uuid,_iat bigint,_delivery uuid,
 _action text,_key uuid,_proof uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 e public.mobility_stage_delivery_events%ROWTYPE;
 event_id uuid;
 roles integer; actual_role text;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _session IS NULL OR _iat IS NULL
 OR _delivery IS NULL OR _key IS NULL
 OR _action IS NULL OR _action NOT IN ('pickup','deliver','return')
 OR (_action='deliver' AND _proof IS NULL)
 OR (_action<>'deliver' AND _proof IS NOT NULL)
 THEN RAISE EXCEPTION 'G212 invalid original courier command'
 USING ERRCODE='P2121'; END IF;
 -- Identity authority: no dual role, revoked or expired G42 provider session.
 SELECT count(*),min(role::text) INTO roles,actual_role
 FROM public.user_roles WHERE user_id=_driver;
 IF roles<>1 OR actual_role<>'driver' THEN
  RAISE EXCEPTION 'G212 exclusive courier role required'
  USING ERRCODE='P2122'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat) THEN
  RAISE EXCEPTION 'G212 courier provider session revoked'
  USING ERRCODE='P2123'; END IF;
 -- Lock original delivery AFTER provider session; this serializes cancellation,
 -- concurrent courier mutations, the G67 proof, and replay for the same ID.
 SELECT * INTO d FROM public.mobility_stage_deliveries
  WHERE id=_delivery FOR UPDATE;
 IF NOT FOUND OR d.courier_id IS DISTINCT FROM _driver OR d.vehicle_id IS NULL
 OR d.sender_id=_driver OR d.requested_vehicle_kind NOT IN ('AUTO','MOTO')
 THEN RAISE EXCEPTION 'G212 original delivery assignment mismatch'
 USING ERRCODE='P2124'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.mobility_vehicles v WHERE v.id=d.vehicle_id
   AND v.driver_id=_driver AND v.vehicle_kind=d.requested_vehicle_kind
   AND v.review_status NOT IN ('rejected','suspended')
 ) THEN RAISE EXCEPTION 'G212 original vehicle/category mismatch'
 USING ERRCODE='P2124'; END IF;
 -- A bare assigned G5 fixture is NOT an accepted original G10 offer.
 IF NOT EXISTS (
  SELECT 1 FROM public.mobility_stage_delivery_offers o
  JOIN public.mobility_stage_delivery_events accepted
   ON accepted.id=o.decision_event_id AND accepted.action='accept'
   AND accepted.delivery_id=o.delivery_id AND accepted.actor_id=o.courier_id
  WHERE o.delivery_id=d.id AND o.courier_id=_driver
   AND o.vehicle_id=d.vehicle_id AND o.status='accepted'
   AND o.decision_key=accepted.request_key
 ) THEN RAISE EXCEPTION 'G212 original private offer missing'
 USING ERRCODE='P2125'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.mobility_stage_g122_delivery_price_consents c
  JOIN public.mobility_stage_fare_quotes q ON q.id=c.quote_id
   AND q.subject_id=c.delivery_id AND q.customer_id=c.sender_id
   AND q.total_pyg=c.accepted_total_gs
  WHERE c.delivery_id=d.id AND c.sender_id=d.sender_id
   AND c.vehicle_kind=d.requested_vehicle_kind
 ) THEN RAISE EXCEPTION 'G212 immutable sender quote consent missing'
 USING ERRCODE='P2126'; END IF;
 -- G5 state/replay/slot authority and G67 deliver proof trigger both execute
 -- INSIDE this same transaction, while G42 and G5 original rows remain locked.
 event_id:=public.mobility_stage_delivery_transition(
   _delivery,_driver,_action,_key,_proof);
 SELECT * INTO e FROM public.mobility_stage_delivery_events
  WHERE id=event_id;
 IF NOT FOUND OR e.delivery_id IS DISTINCT FROM d.id
 OR e.actor_id IS DISTINCT FROM _driver OR e.action IS DISTINCT FROM _action
 OR e.request_key IS DISTINCT FROM _key
 OR e.proof_ref IS DISTINCT FROM _proof
 OR e.next_status IS DISTINCT FROM
   (CASE _action WHEN 'pickup' THEN 'picked_up'
    WHEN 'deliver' THEN 'delivered' ELSE 'returned' END)::public.mobility_stage_delivery_status
 THEN RAISE EXCEPTION 'G212 original event receipt not persisted'
 USING ERRCODE='P2127'; END IF;
 RETURN event_id;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g212_courier_custody_step_qa(
 uuid,uuid,bigint,uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g212_courier_custody_step_qa(
 uuid,uuid,bigint,uuid,text,uuid,uuid) TO service_role;
COMMIT;
