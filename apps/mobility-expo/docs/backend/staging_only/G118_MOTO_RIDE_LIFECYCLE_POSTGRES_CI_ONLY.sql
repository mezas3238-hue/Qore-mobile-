-- G118: MOTO passengers durable state and Driver command pipeline.
-- GitHub PostgreSQL16 disposable ONLY. NO legal assignment or LIVE enabled.
-- Independent municipality/insurance evidence has NOT been certified;
-- the legal gate below stays impossible in this CI schema by design.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g103_one_active_ride_qa()') IS NULL
 OR to_regclass('public.mobility_stage_g100_moto_trips') IS NULL
 THEN RAISE EXCEPTION 'G118 disposable G71/G100/G103 prerequisites missing'; END IF;
END $guard$;
BEGIN;
-- G100 had only searching/cancelled. Change state constraints without removing
-- fare, trip ownership or double-entry integrity invariants.
DO $constraints$ DECLARE c record; BEGIN
 FOR c IN SELECT conname
  FROM pg_catalog.pg_constraint
  WHERE conrelid='public.mobility_stage_g100_moto_trips'::regclass
   AND contype='c'
   AND (pg_catalog.pg_get_constraintdef(oid) LIKE '%status%'
    OR pg_catalog.pg_get_constraintdef(oid) LIKE '%revision%')
 LOOP EXECUTE pg_catalog.format(
  'ALTER TABLE public.mobility_stage_g100_moto_trips DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $constraints$;
ALTER TABLE public.mobility_stage_g100_moto_trips
 ADD COLUMN driver_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 ADD COLUMN vehicle_id uuid,
 ADD COLUMN accepted_offer_id uuid,
 ADD COLUMN completed_at timestamptz,
 ADD CONSTRAINT g118_moto_status
 CHECK(status IN ('searching','accepted','arriving','in_progress','completed','cancelled')),
 ADD CONSTRAINT g118_moto_revision CHECK(revision BETWEEN 1 AND 1000000000),
 ADD CONSTRAINT g118_moto_status_proof CHECK(
  (status='searching' AND revision=1 AND driver_id IS NULL
   AND vehicle_id IS NULL AND accepted_offer_id IS NULL
   AND completed_at IS NULL AND cancellation_key IS NULL AND cancellation_event_id IS NULL)
 OR(status='cancelled' AND revision=2 AND driver_id IS NULL
   AND vehicle_id IS NULL AND accepted_offer_id IS NULL
   AND completed_at IS NULL AND cancellation_key IS NOT NULL AND cancellation_event_id IS NOT NULL)
 OR(status IN ('accepted','arriving','in_progress','completed')
   AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND accepted_offer_id IS NOT NULL
   AND cancellation_key IS NULL AND cancellation_event_id IS NULL
   AND (status='completed')=(completed_at IS NOT NULL)
   AND revision>=2)
 );
DROP INDEX public.mobility_stage_g100_one_active_moto_passenger;
CREATE UNIQUE INDEX mobility_stage_g118_one_active_moto_passenger
 ON public.mobility_stage_g100_moto_trips(passenger_id)
 WHERE status IN('searching','accepted','arriving','in_progress');

-- An explicitly non-authorizing legal placeholder, NEVER source of a
-- synthetic "permit". No authenticated/service_role can modify it.
CREATE TABLE public.mobility_stage_g118_moto_legal_zones(
 zone_tag text PRIMARY KEY CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 service_kind text NOT NULL DEFAULT 'MOTO_RIDE' CHECK(service_kind='MOTO_RIDE'),
 independently_authorized boolean NOT NULL DEFAULT false
  CHECK(independently_authorized=false),
 country_code text NOT NULL DEFAULT 'PY' CHECK(country_code='PY')
);
ALTER TABLE public.mobility_stage_g118_moto_legal_zones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g118_moto_legal_zones
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.mobility_stage_g118_moto_offers(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 trip_id uuid NOT NULL REFERENCES public.mobility_stage_g100_moto_trips(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 vehicle_id uuid NOT NULL,
 request_key uuid NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'offered' CHECK(status IN('offered','accepted','declined','expired')),
 decision_key uuid UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK(expires_at>created_at),UNIQUE(trip_id,driver_id,vehicle_id)
);
ALTER TABLE public.mobility_stage_g118_moto_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g118_moto_offers
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.mobility_stage_g118_moto_events(
 trip_id uuid NOT NULL REFERENCES public.mobility_stage_g100_moto_trips(id),
 revision bigint NOT NULL CHECK(revision>=3),
 command_key uuid NOT NULL UNIQUE,
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 from_state text NOT NULL,
 to_state text NOT NULL CHECK(to_state IN('arriving','in_progress','completed')),
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(trip_id,revision),
 CHECK((from_state='accepted' AND to_state='arriving') OR
       (from_state='arriving' AND to_state='in_progress') OR
       (from_state='in_progress' AND to_state='completed'))
);
ALTER TABLE public.mobility_stage_g118_moto_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g118_moto_events
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g118_legal_moto_gate_qa(_driver uuid,_vehicle uuid,_zone text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RETURN false; END IF;
 -- G71's locked, independently attested 8-document dossier is mandatory;
 -- it is NEVER equivalent to a municipal passenger-MOTO authorization.
 IF NOT public.mobility_stage_g71_valid_locked_dossier(_driver,_vehicle)
 THEN RETURN false; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.mobility_vehicles v
  WHERE v.id=_vehicle AND v.driver_id=_driver AND v.vehicle_kind='MOTO'
    AND v.service_kind='moto_pasajero' AND v.country_code='PY')
 THEN RETURN false; END IF;
 -- This will be FALSE until genuine municipal/legal and geofence machinery
 -- replaces the disposable table. No fake approval via SQL is allowed.
 RETURN EXISTS(SELECT 1 FROM public.mobility_stage_g118_moto_legal_zones z
  WHERE z.zone_tag=_zone AND z.country_code='PY'
   AND z.independently_authorized IS TRUE);
END $fn$;

-- The only service-role offer path. A booking request contains NO driver ID:
-- a future backend dispatcher must choose a candidate on the server.
CREATE FUNCTION public.mobility_stage_g118_moto_offer_qa(
 _booking uuid,_driver uuid,_vehicle uuid,_request uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE t public.mobility_stage_g100_moto_trips%ROWTYPE;
 q public.mobility_stage_g100_moto_quotes%ROWTYPE;
 existing public.mobility_stage_g118_moto_offers%ROWTYPE;
 created uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _booking IS NULL OR _driver IS NULL OR _vehicle IS NULL OR _request IS NULL
 THEN RAISE EXCEPTION 'G118 invalid private dispatch context' USING ERRCODE='P1181'; END IF;
 SELECT * INTO t FROM public.mobility_stage_g100_moto_trips
 WHERE booking_key=_booking FOR UPDATE;
 IF NOT FOUND OR t.status<>'searching'
 THEN RAISE EXCEPTION 'G118 no active owned MOTO search' USING ERRCODE='P1181'; END IF;
 SELECT * INTO q FROM public.mobility_stage_g100_moto_quotes
 WHERE id=t.quote_id AND passenger_id=t.passenger_id FOR SHARE;
 IF NOT FOUND OR NOT public.mobility_stage_g118_legal_moto_gate_qa(_driver,_vehicle,q.zone_tag)
 THEN RAISE EXCEPTION 'G118 MOTO passenger legal dispatch proof unavailable'
 USING ERRCODE='P1181'; END IF;
 SELECT * INTO existing FROM public.mobility_stage_g118_moto_offers WHERE request_key=_request;
 IF FOUND THEN
  IF ROW(existing.trip_id,existing.driver_id,existing.vehicle_id)
   IS DISTINCT FROM ROW(t.id,_driver,_vehicle)
  THEN RAISE EXCEPTION 'G118 conflicting offer replay' USING ERRCODE='P1181'; END IF;
  RETURN existing.id;
 END IF;
 INSERT INTO public.mobility_stage_g118_moto_offers
  (trip_id,driver_id,vehicle_id,request_key,expires_at)
 VALUES(t.id,_driver,_vehicle,_request,pg_catalog.clock_timestamp()+interval '30 seconds')
 RETURNING id INTO created;
 RETURN created;
END $fn$;

CREATE FUNCTION public.mobility_stage_g118_moto_accept_qa(
 _offer uuid,_driver uuid,_decision uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE o public.mobility_stage_g118_moto_offers%ROWTYPE;
 t public.mobility_stage_g100_moto_trips%ROWTYPE;
 q public.mobility_stage_g100_moto_quotes%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _offer IS NULL OR _driver IS NULL OR _decision IS NULL
 THEN RAISE EXCEPTION 'G118 invalid offer decision' USING ERRCODE='P1181'; END IF;
 SELECT * INTO o FROM public.mobility_stage_g118_moto_offers
 WHERE id=_offer AND driver_id=_driver FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G118 foreign offer' USING ERRCODE='P1181'; END IF;
 SELECT * INTO t FROM public.mobility_stage_g100_moto_trips
 WHERE id=o.trip_id FOR UPDATE;
 SELECT * INTO q FROM public.mobility_stage_g100_moto_quotes
 WHERE id=t.quote_id FOR SHARE;
 IF t.status='accepted' AND o.status='accepted' AND o.decision_key=_decision
 THEN RETURN public.mobility_stage_g118_moto_status_qa(t.passenger_id,t.booking_key); END IF;
 IF t.status<>'searching' OR o.status<>'offered'
 OR o.expires_at<=pg_catalog.clock_timestamp()
 OR NOT public.mobility_stage_g118_legal_moto_gate_qa(_driver,o.vehicle_id,q.zone_tag)
 THEN RAISE EXCEPTION 'G118 MOTO acceptance is not legally authorized'
 USING ERRCODE='P1181'; END IF;
 UPDATE public.mobility_stage_g100_moto_trips SET status='accepted',revision=2,
  driver_id=_driver,vehicle_id=o.vehicle_id,accepted_offer_id=o.id,
  updated_at=pg_catalog.clock_timestamp() WHERE id=t.id;
 UPDATE public.mobility_stage_g118_moto_offers
 SET status='accepted',decision_key=_decision WHERE id=o.id;
 RETURN public.mobility_stage_g118_moto_status_qa(t.passenger_id,t.booking_key);
END $fn$;

-- Driver movement is available only after a trusted, already accepted offer.
-- This DOES NOT create the legal authorization, GPS, ETA or financial capture.
CREATE FUNCTION public.mobility_stage_g118_moto_driver_step_qa(
 _booking uuid,_driver uuid,_revision bigint,_next text,_command uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE t public.mobility_stage_g100_moto_trips%ROWTYPE;
 duplicate public.mobility_stage_g118_moto_events%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _booking IS NULL OR _driver IS NULL OR _command IS NULL
 OR _next NOT IN ('arriving','in_progress','completed') OR _revision IS NULL
 THEN RAISE EXCEPTION 'G118 invalid Driver command' USING ERRCODE='P1181'; END IF;
 SELECT * INTO t FROM public.mobility_stage_g100_moto_trips
 WHERE booking_key=_booking FOR UPDATE;
 IF NOT FOUND OR t.driver_id IS DISTINCT FROM _driver
 THEN RAISE EXCEPTION 'G118 trip does not belong to Driver' USING ERRCODE='P1181'; END IF;
 SELECT * INTO duplicate FROM public.mobility_stage_g118_moto_events
 WHERE command_key=_command;
 IF FOUND THEN
  IF duplicate.trip_id<>t.id OR duplicate.driver_id<>_driver
    OR duplicate.to_state<>_next OR duplicate.revision<>_revision+1
  THEN RAISE EXCEPTION 'G118 conflicting Driver command' USING ERRCODE='P1181'; END IF;
  RETURN public.mobility_stage_g118_moto_status_qa(t.passenger_id,t.booking_key);
 END IF;
 IF t.revision<>_revision OR NOT (
  (t.status='accepted' AND _next='arriving') OR
  (t.status='arriving' AND _next='in_progress') OR
  (t.status='in_progress' AND _next='completed'))
 THEN RAISE EXCEPTION 'G118 stale or invalid Driver transition' USING ERRCODE='P1181'; END IF;
 UPDATE public.mobility_stage_g100_moto_trips SET status=_next,
  revision=t.revision+1,updated_at=pg_catalog.clock_timestamp(),
  completed_at=CASE WHEN _next='completed' THEN pg_catalog.clock_timestamp()
   ELSE NULL END WHERE id=t.id;
 INSERT INTO public.mobility_stage_g118_moto_events
  (trip_id,revision,command_key,driver_id,from_state,to_state)
 VALUES(t.id,t.revision+1,_command,_driver,t.status,_next);
 RETURN public.mobility_stage_g118_moto_status_qa(t.passenger_id,t.booking_key);
END $fn$;

-- Server-owned Passenger read: private, revisioned, no Driver PII/GPS/ETA.
CREATE FUNCTION public.mobility_stage_g118_moto_status_qa(_passenger uuid,_booking uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',t.passenger_id,'bookingKey',t.booking_key,'tripId',t.id,
  'serviceKind','MOTO_RIDE','tripState',t.status,'tripRevision',t.revision,
  'driverAssigned',(t.status IN ('accepted','arriving','in_progress','completed')),
  'driverIdentityExposed',false,'gpsVerified',false,'etaAvailable',false,
  'commissionBps',q.commission_bps,'subsidyBps',1000,
  'amountGs',q.fare_gs,'customerPaysGs',q.customer_pays_gs,
  'customerSubsidyGs',q.subsidy_gs,
  'financialState',CASE WHEN t.status='cancelled' THEN 'VOIDED_QA'
   WHEN t.status='completed' THEN 'COMPLETED_UNSETTLED_QA'
   ELSE 'RESERVED_QA' END,'pspCollected',false,
  'serverPersisted',true)
 FROM public.mobility_stage_g100_moto_trips t
 JOIN public.mobility_stage_g100_moto_quotes q
  ON q.id=t.quote_id AND q.passenger_id=t.passenger_id
 WHERE t.passenger_id=$1 AND t.booking_key=$2
$fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_g118_legal_moto_gate_qa(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g118_moto_offer_qa(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g118_moto_accept_qa(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g118_moto_driver_step_qa(uuid,uuid,bigint,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g118_moto_status_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g118_moto_offer_qa(uuid,uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g118_moto_accept_qa(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g118_moto_driver_step_qa(uuid,uuid,bigint,text,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g118_moto_status_qa(uuid,uuid)
 TO service_role;
COMMIT;
