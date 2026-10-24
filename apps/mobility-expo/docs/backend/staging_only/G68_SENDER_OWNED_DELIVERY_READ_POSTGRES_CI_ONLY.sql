-- G68 / A57 — sender-owned private custody, disposable PostgreSQL16 only.
-- NOT deployed; no direct SDK permissions and no remote SQL. Depends on G67.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_g67_proof_verified_owner_qa(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G68 refuses remote/incomplete G67/G42';
 END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g68_sender_custody_owner_qa(
 _actor uuid,_session uuid,_iat_ms bigint,_delivery uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 assigned boolean; verified boolean:=false;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _delivery IS NULL
 OR _iat_ms IS NULL OR _iat_ms NOT BETWEEN 0 AND 9999999999999
 THEN RAISE EXCEPTION 'G68 invalid sender custody scope' USING ERRCODE='G6801'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G68 session revoked or invalid' USING ERRCODE='G6802'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_actor)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor
  AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G68 exclusive Passenger role required'
  USING ERRCODE='G6803'; END IF;
 -- Both predicates execute in SQL. Sender cannot infer another delivery by UUID.
 -- SHARE lock prevents a concurrent courier state update until this snapshot ends.
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery AND sender_id=_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G68 delivery unavailable'
  USING ERRCODE='G6804'; END IF;
 assigned:=d.courier_id IS NOT NULL AND d.vehicle_id IS NOT NULL;
 IF (d.courier_id IS NULL)<>(d.vehicle_id IS NULL)
 OR (d.status='requested' AND (assigned OR d.proof_ref IS NOT NULL))
 OR (d.status IN ('accepted','picked_up','delivered','disputed','returned')
   AND NOT assigned)
 OR (d.status IN ('requested','accepted','picked_up') AND d.proof_ref IS NOT NULL)
 OR (d.status IN ('delivered','disputed','returned') AND d.proof_ref IS NULL)
 THEN RAISE EXCEPTION 'G68 invalid persisted custody state'
  USING ERRCODE='G6805'; END IF;
 IF d.proof_ref IS NOT NULL THEN
  verified:=public.mobility_stage_g67_proof_verified_owner_qa(
   d.id,d.courier_id,d.proof_ref);
  IF verified IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'G68 independent receipt not verified'
   USING ERRCODE='G6805'; END IF;
 END IF;
 -- EXACT B R62 DTO: no raw proof, courier, phone, GPS or storage metadata.
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','deliveryId',d.id,'ownerId',_actor,
  'state',d.status::text,'revision',d.revision,
  'vehicleKind',d.requested_vehicle_kind::text,
  'assignmentPersisted',assigned,'proofVerified',verified,
  'qaOnly',true,'productionEnabled',false,'liveDeliveriesEnabled',false);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g68_sender_custody_owner_qa(
 uuid,uuid,bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
