-- G130: atomic pessimistic budget reservation for Geoapify FREE routing.
-- Runs ONLY in a disposable local PostgreSQL 16 CI database. No real API.
-- One coverageEvidenceId = one unique route credit reservation. A retry
-- cannot authorize a second external call even after a lost quota ACK.
DO $gate$ BEGIN
 IF current_database()<>'qore_disposable_geoapify'
 OR current_setting('application_name')<>'qore_ci_disposable_geoapify'
 THEN RAISE EXCEPTION 'G130 refuses non-disposable database'; END IF;
END $gate$;
BEGIN;
CREATE TABLE public.mobility_stage_g130_free_quota_days (
 quota_day date PRIMARY KEY,
 calls integer NOT NULL DEFAULT 0 CHECK(calls BETWEEN 0 AND 100),
 credits integer NOT NULL DEFAULT 0 CHECK(credits BETWEEN 0 AND 300),
 CHECK(credits=calls*3)
);
CREATE TABLE public.mobility_stage_g130_free_route_reservations (
 request_key uuid PRIMARY KEY,
 reservation_id uuid NOT NULL UNIQUE,
 actor_id uuid NOT NULL,
 delivery_id uuid NOT NULL,
 vehicle_kind text NOT NULL CHECK(vehicle_kind IN ('AUTO','MOTO')),
 coverage_evidence_id uuid NOT NULL UNIQUE,
 quota_day date NOT NULL REFERENCES public.mobility_stage_g130_free_quota_days(quota_day),
 reserved_credits integer NOT NULL CHECK(reserved_credits=3),
 reserved_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
ALTER TABLE public.mobility_stage_g130_free_quota_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g130_free_route_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g130_free_quota_days
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g130_free_route_reservations
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mobility_stage_g130_reserve_geoapify_free_qa(
 _actor uuid,_delivery uuid,_vehicle text,_coverage_evidence uuid,
 _request_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $func$
DECLARE d date;
 dayrow public.mobility_stage_g130_free_quota_days%ROWTYPE;
 existing public.mobility_stage_g130_free_route_reservations%ROWTYPE;
 rid uuid;
BEGIN
 IF current_database()<>'qore_disposable_geoapify'
 OR current_setting('application_name')<>'qore_ci_disposable_geoapify'
 OR _actor IS NULL OR _delivery IS NULL OR _coverage_evidence IS NULL
 OR _request_key IS NULL OR _request_key<>_coverage_evidence
 OR _vehicle NOT IN ('AUTO','MOTO')
 THEN RAISE EXCEPTION 'G130 invalid server-side quota scope'
  USING ERRCODE='P1301'; END IF;
 -- This is a provider accounting date, not the sender's timezone or phone.
 d := (pg_catalog.clock_timestamp() AT TIME ZONE 'UTC')::date;
 INSERT INTO public.mobility_stage_g130_free_quota_days(quota_day)
 VALUES(d) ON CONFLICT(quota_day) DO NOTHING;
 -- A single row lock serializes EVERY server replica's requests for UTC day.
 SELECT * INTO dayrow FROM public.mobility_stage_g130_free_quota_days
 WHERE quota_day=d FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G130 quota row absent'
  USING ERRCODE='P1301'; END IF;
 SELECT * INTO existing
 FROM public.mobility_stage_g130_free_route_reservations
 WHERE request_key=_request_key OR coverage_evidence_id=_coverage_evidence;
 IF FOUND THEN
  IF existing.actor_id<>_actor OR existing.delivery_id<>_delivery
  OR existing.vehicle_kind<>_vehicle
  OR existing.coverage_evidence_id<>_coverage_evidence
  OR existing.request_key<>_request_key
  THEN RAISE EXCEPTION 'G130 contradictory idempotency key'
   USING ERRCODE='P1301'; END IF;
  -- No second provider call. Returning approved:true here would spend a
  -- second billable credit if the first provider ACK was lost.
  RETURN pg_catalog.jsonb_build_object(
   'approved',false,'durable',true,'replayBlocked',true,
   'reservationId',existing.reservation_id,
   'deliveryId',existing.delivery_id,'vehicleKind',existing.vehicle_kind,
   'coverageEvidenceId',existing.coverage_evidence_id,
   'provider','GEOAPIFY_FREE','reason','ALREADY_RESERVED_NO_RETRY');
 END IF;
 IF dayrow.calls>=100 OR dayrow.credits>297 THEN
  RETURN pg_catalog.jsonb_build_object(
   'approved',false,'durable',true,'reason','FREE_DAILY_BUDGET_EXHAUSTED',
   'deliveryId',_delivery,'vehicleKind',_vehicle,
   'coverageEvidenceId',_coverage_evidence);
 END IF;
 -- PostgreSQL gen_random_uuid() is server-side, no browser-supplied receipt.
 rid:=pg_catalog.gen_random_uuid();
 INSERT INTO public.mobility_stage_g130_free_route_reservations(
  request_key,reservation_id,actor_id,delivery_id,vehicle_kind,
  coverage_evidence_id,quota_day,reserved_credits
 ) VALUES(_request_key,rid,_actor,_delivery,_vehicle,_coverage_evidence,d,3);
 UPDATE public.mobility_stage_g130_free_quota_days SET
  calls=calls+1,credits=credits+3 WHERE quota_day=d;
 RETURN pg_catalog.jsonb_build_object(
  'approved',true,'durable',true,'reservationId',rid,
  'deliveryId',_delivery,'vehicleKind',_vehicle,
  'coverageEvidenceId',_coverage_evidence,
  'provider','GEOAPIFY_FREE','reservedCredits',3,
  'quotaDay',d::text);
END $func$;
REVOKE ALL ON FUNCTION public.mobility_stage_g130_reserve_geoapify_free_qa(
 uuid,uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g130_reserve_geoapify_free_qa(
 uuid,uuid,text,uuid,uuid) TO service_role;
COMMIT;
