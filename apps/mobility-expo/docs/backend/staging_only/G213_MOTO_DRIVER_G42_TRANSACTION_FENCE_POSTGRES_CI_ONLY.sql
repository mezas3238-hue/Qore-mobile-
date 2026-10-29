-- G213 original G100/G118 MOTO Driver command bound to G42 provider session.
-- Disposable PG16 only; DOES NOT authorize municipal passenger-MOTO service.
-- Locks provider grant through the same SQL COMMIT that changes the trip.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g118_moto_driver_step_qa(uuid,uuid,bigint,text,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g118_moto_offers') IS NULL
 THEN RAISE EXCEPTION 'G213 refuses non-disposable or incomplete G42/G118 chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g213_moto_driver_step_qa(
 _driver uuid,_session uuid,_iat bigint,_booking uuid,
 _revision bigint,_next text,_command uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 roles_count integer; role_name text; trip_id uuid; current_status text;
 result jsonb;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _session IS NULL OR _iat IS NULL
 OR _booking IS NULL OR _revision NOT BETWEEN 2 AND 4
 OR _next NOT IN ('arriving','in_progress','completed')
 OR _command IS NULL
 THEN RAISE EXCEPTION 'G213 unverified MOTO driver command' USING ERRCODE='P2131'; END IF;
 SELECT pg_catalog.count(*),pg_catalog.min(role::text)
 INTO roles_count,role_name
 FROM public.user_roles WHERE user_id=_driver;
 IF roles_count<>1 OR role_name<>'driver' THEN
  RAISE EXCEPTION 'G213 exclusive Driver role required' USING ERRCODE='P2131'; END IF;
 -- The grant row remains share-locked until COMMIT. Revocation cannot
 -- slip between the HTTP identity check and the actual PostgreSQL step.
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat) THEN
  RAISE EXCEPTION 'G213 provider Driver session revoked' USING ERRCODE='P2131'; END IF;
 -- The original G118 accepted offer must be owned by the same Driver,
 -- vehicle and immutable MOTO booking. This is not a new offer/permit issuer.
 SELECT t.id,t.status INTO trip_id,current_status
 FROM public.mobility_stage_g100_moto_trips t
 JOIN public.mobility_stage_g100_moto_quotes q
  ON q.id=t.quote_id AND q.passenger_id=t.passenger_id
 JOIN public.mobility_stage_g118_moto_offers o
  ON o.id=t.accepted_offer_id AND o.trip_id=t.id
  AND o.driver_id=t.driver_id AND o.vehicle_id=t.vehicle_id
  AND o.status='accepted' AND o.decision_key IS NOT NULL
 WHERE t.booking_key=_booking AND t.driver_id=_driver
  AND t.status IN ('accepted','arriving','in_progress','completed')
 LIMIT 1;
 IF trip_id IS NULL THEN
  RAISE EXCEPTION 'G213 original accepted G118 MOTO offer not verified'
   USING ERRCODE='P2131'; END IF;
 result:=public.mobility_stage_g118_moto_driver_step_qa(
  _booking,_driver,_revision,_next,_command);
 IF result IS NULL OR result->>'serviceKind'<>'MOTO_RIDE'
  OR result->>'bookingKey'<>_booking::text
  OR result->>'tripId'<>trip_id::text
  OR (result->>'tripRevision')::integer NOT BETWEEN _revision+1 AND 5
  OR result->>'serverPersisted'<>'true'
  OR result->>'commercialEnabled'<>'false'
 THEN RAISE EXCEPTION 'G213 returned unverified original state'
   USING ERRCODE='P2131'; END IF;
 RETURN result;
END $body$;
-- Direct service_role calls to the pre-G42 G118 method are now forbidden.
-- The owner-only G213 function is the sole HTTP runtime mutation entry.
REVOKE ALL ON FUNCTION public.mobility_stage_g118_moto_driver_step_qa(
 uuid,uuid,bigint,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g213_moto_driver_step_qa(
 uuid,uuid,bigint,uuid,bigint,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g213_moto_driver_step_qa(
 uuid,uuid,bigint,uuid,bigint,text,uuid) TO service_role;
COMMIT;
