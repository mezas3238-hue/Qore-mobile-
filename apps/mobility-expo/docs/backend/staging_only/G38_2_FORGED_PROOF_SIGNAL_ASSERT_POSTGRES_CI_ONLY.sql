-- G38.2 forged proof and synthetic GPS attack; must STILL fail by policy.
-- Database-owner fixture is intentionally adversarial, not an Auth provider.
-- Run ONLY in qore_disposable_chain immediately AFTER G38.1 installation/test.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
  OR current_setting('application_name')<>'qore_ci_disposable_chain'
  OR to_regclass('public.mobility_stage_g38_trusted_offer_proofs') IS NULL
 THEN RAISE EXCEPTION 'G38.2 refuses non-disposable PostgreSQL'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('b6382000-0000-4638-8638-000000000001')
ON CONFLICT DO NOTHING;
-- The database owner is allowed to forge the private proof in this
-- disposable attack scenario. No API/client or service_role has such rights.
DO $fixture$
DECLARE
 driver uuid:='00000000-0000-4000-8000-000000000181';
 vehicle uuid:='00000000-0000-4000-8000-000000000184';
 zone uuid;
 zone_rev bigint;
 consent_rev bigint;
 seq bigint;
 event uuid:='b6382000-0000-4638-8638-000000000009';
 trip uuid;
 offer uuid;
BEGIN
 SELECT z.zone_id,z.revision INTO zone,zone_rev
 FROM public.mobility_stage_g31_zone_coverage z
 WHERE z.service_kind='AUTO_RIDE' AND z.coverage_status='ACTIVE'
  AND z.eligible_by_policy=false
 ORDER BY z.zone_id LIMIT 1;
 IF zone IS NULL THEN
  RAISE EXCEPTION 'G38.2 lacks synthetic ACTIVE but noneligible zone'; END IF;
 SELECT c.revision INTO consent_rev
 FROM public.mobility_location_consents c
 WHERE c.driver_id=driver AND c.revoked_at IS NULL;
 IF consent_rev IS NULL THEN
  RAISE EXCEPTION 'G38.2 lacks synthetic current consent'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots
    WHERE driver_id=driver)
 THEN RAISE EXCEPTION 'G38.2 driver unexpectedly active'; END IF;
 SELECT COALESCE(last_sequence,0)+1 INTO seq
 FROM public.mobility_stage_g32_signal_state WHERE driver_id=driver;
 IF seq IS NULL THEN seq:=1; END IF;
 -- Forge a perfect-looking latest GPS quarantine row and live-looking
 -- available bit as privileged disposable DB owner; still insufficient
 -- for legal service zone activation.
 UPDATE public.driver_locations SET available=true,
   updated_at=pg_catalog.clock_timestamp()
 WHERE driver_id=driver;
 INSERT INTO public.mobility_stage_g32_signal_quarantine(
   event_id,driver_id,sequence,captured_at,zone_id,service_kind,
   consent_revision,geometry_revision)
 VALUES(event,driver,seq,pg_catalog.clock_timestamp(),zone,'AUTO_RIDE',
   consent_rev,1);
 INSERT INTO public.mobility_stage_g32_signal_state(
   driver_id,last_sequence,last_captured_at,last_event_id)
 VALUES(driver,seq,pg_catalog.clock_timestamp(),event)
 ON CONFLICT(driver_id) DO UPDATE SET
  last_sequence=EXCLUDED.last_sequence,
  last_captured_at=EXCLUDED.last_captured_at,
  last_event_id=EXCLUDED.last_event_id;
 -- Create a genuine G4 private offer with the existing authorized
 -- server-only RPC, as an owner in this synthetic QA transaction.
 trip:=public.mobility_stage_auto_demo_request(
  'b6382000-0000-4638-8638-000000000001',
  'b6382000-0000-4638-8638-000000000002',
  'CENTRO','LAMBRARE','economico');
 offer:=public.mobility_stage_auto_demo_offer(
  trip,driver,vehicle,'b6382000-0000-4638-8638-000000000003',30);
 INSERT INTO public.mobility_stage_g38_trusted_offer_proofs(
   offer_id,job_kind,job_id,driver_id,vehicle_id,zone_id,
   service_kind,consent_revision,geometry_revision,policy_revision,
   issuer_kind,issued_at,expires_at
 ) VALUES (
   offer,'AUTO_RIDE',trip,driver,vehicle,zone,
   'AUTO_RIDE',consent_rev,1,zone_rev,
   'CERTIFIED_REAL_SERVER_AUTH_AND_GEOFENCE',
   pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()+interval '20 seconds'
 );
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g38_trusted_offer_proofs
   WHERE offer_id=offer)
 THEN RAISE EXCEPTION 'G38.2 owner forge fixture absent'; END IF;
END $fixture$;
SET LOCAL ROLE service_role;
DO $attack$
DECLARE offer uuid; denied boolean:=false;
BEGIN
 SELECT id INTO offer FROM public.mobility_stage_auto_demo_offers
  WHERE request_key='b6382000-0000-4638-8638-000000000003';
 IF offer IS NULL THEN RAISE EXCEPTION 'G38.2 legitimate private offer missing'; END IF;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   offer,'00000000-0000-4000-8000-000000000181',
   'b6382000-0000-4638-8638-000000000004');
 EXCEPTION WHEN SQLSTATE 'G3801' THEN denied:=true; END;
 IF NOT denied THEN
  RAISE EXCEPTION 'G38.2 forged proof/GPS bypassed noneligible zone'; END IF;
END $attack$;
RESET ROLE;
DO $invariants$
DECLARE trip uuid; offer uuid; driver uuid:='00000000-0000-4000-8000-000000000181';
BEGIN
 SELECT id INTO trip FROM public.mobility_stage_auto_demo_trips
  WHERE request_key='b6382000-0000-4638-8638-000000000002';
 SELECT id INTO offer FROM public.mobility_stage_auto_demo_offers
  WHERE request_key='b6382000-0000-4638-8638-000000000003';
 IF (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>'searching'
 OR (SELECT status FROM public.mobility_stage_auto_demo_offers WHERE id=offer)<>'offered'
 OR EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots WHERE driver_id=driver)
 OR EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_events
   WHERE trip_id=trip AND next_status='accepted')
 THEN RAISE EXCEPTION 'G38.2 rejected fake authorization mutated trip/offer/slot/event'; END IF;
 RAISE NOTICE 'G38.2 PASS: forged trusted proof + newest GPS + valid KYC still cannot bypass noneligible zone';
END $invariants$;
ROLLBACK;
