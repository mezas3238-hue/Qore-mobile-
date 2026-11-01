-- G282 — pending vehicle intake with exact G42 provider-session lock
-- PostgreSQL 17 STAGING candidate. No vehicle approved/materialized, no LIVE.
-- Safe only when G42 and baseline G2 are installed; enforce narrow ACL.
DO $pre$ BEGIN
 IF to_regnamespace('qore_stage_internal') IS NULL OR
    to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL OR
    to_regclass('public.mobility_vehicle_applications') IS NULL OR
    to_regprocedure('public.mobility_submit_vehicle_draft(uuid,uuid,mobility_vehicle_kind,mobility_service_kind,text,text,text,text,integer,integer)') IS NULL
 THEN RAISE EXCEPTION 'G282 requires installed G2 and G42'; END IF;
END $pre$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g282_submit_vehicle_pending_qa(
 _driver uuid,_session uuid,_iat_ms bigint,_request uuid,
 _kind text,_service text,_municipality text,_plate text,
 _brand text,_model text,_year integer,_capacity integer
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE pending_id uuid;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat_ms IS NULL OR
    _request IS NULL OR _kind IS NULL OR _service IS NULL OR
    _municipality IS NULL OR _plate IS NULL OR _brand IS NULL OR
    _model IS NULL OR _year IS NULL OR _capacity IS NULL
 THEN RAISE EXCEPTION 'G282 incomplete pending application'
   USING ERRCODE='P2821'; END IF;
 -- SQL G42 takes the transactional provider session lock. Not merely a
 -- separate HTTP login check (which would race against logout/revocation).
 IF public.mobility_stage_g42_lock_session(_driver,_session,_iat_ms)
    IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G282 revoked or unavailable provider session'
   USING ERRCODE='P2822'; END IF;
 IF (SELECT count(*) FROM public.user_roles r
      WHERE r.user_id=_driver AND r.role='driver'::public.app_role)<>1
 THEN RAISE EXCEPTION 'G282 exclusive Driver authority missing'
   USING ERRCODE='P2823'; END IF;
 -- The G2 original function performs idempotent draft storage only.
 -- It deliberately accepts draft data as unverified, never legal KYC.
 pending_id:=public.mobility_submit_vehicle_draft(
  _driver,_request,_kind::public.mobility_vehicle_kind,
  _service::public.mobility_service_kind,_municipality,
  _plate,_brand,_model,_year,_capacity);
 IF pending_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.mobility_vehicle_applications a
   WHERE a.id=pending_id AND a.driver_id=_driver
    AND a.request_key=_request
    AND a.status='pending'::public.mobility_review_status
    AND a.evidence_unverified=true)
 THEN RAISE EXCEPTION 'G282 pending-only SQL receipt unavailable'
   USING ERRCODE='P2824'; END IF;
 RETURN pending_id;
END $f$;

CREATE FUNCTION public.mobility_stage_g282_submit_vehicle_pending_qa(
 _driver uuid,_session uuid,_iat_ms bigint,_request uuid,
 _kind text,_service text,_municipality text,_plate text,
 _brand text,_model text,_year integer,_capacity integer
) RETURNS uuid
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g282_submit_vehicle_pending_qa(
 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g282_submit_vehicle_pending_qa(
 uuid,uuid,bigint,uuid,text,text,text,text,text,text,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_g282_submit_vehicle_pending_qa(
 uuid,uuid,bigint,uuid,text,text,text,text,text,text,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g282_submit_vehicle_pending_qa(
 uuid,uuid,bigint,uuid,text,text,text,text,text,text,integer,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_g282_submit_vehicle_pending_qa(
 uuid,uuid,bigint,uuid,text,text,text,text,text,text,integer,integer)
 TO service_role;
