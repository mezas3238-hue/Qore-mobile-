-- G169: Driver-private projection of an already LEGALLY accepted G118
-- MOTO_RIDE original booking. CI disposable only, never a dispatch authority.
BEGIN;
CREATE FUNCTION public.mobility_stage_g169_driver_moto_status_qa(
 _driver uuid,_booking uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='' AS $fn$
DECLARE t public.mobility_stage_g100_moto_trips%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _booking IS NULL THEN
  RAISE EXCEPTION 'G169 forbidden context' USING ERRCODE='P1691';
 END IF;
 SELECT * INTO t FROM public.mobility_stage_g100_moto_trips
 WHERE booking_key=_booking AND driver_id=_driver
  AND status IN ('accepted','arriving','in_progress','completed');
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','qaOnly',true,'productionEnabled',false,
  'serviceKind','MOTO_RIDE','driverId',_driver,
  'bookingKey',_booking,'tripId',t.id,'tripState',t.status,
  'tripRevision',t.revision,'serverPersisted',true);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g169_driver_moto_status_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g169_driver_moto_status_qa(uuid,uuid)
 TO service_role;
COMMIT;
