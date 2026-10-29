-- G189: only the Driver's ORIGINAL already accepted G118 MOTO ride.
-- No incoming offer, fake municipality permit, assignment, GPS or money.
-- CI/disposable ONLY; the only caller is trusted service_role AFTER
-- independent revocable IdP + exclusive Driver role verification.
BEGIN;
CREATE FUNCTION public.mobility_stage_g189_driver_moto_current_qa(_driver uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='' AS $fn$
DECLARE n integer; b uuid;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL
 THEN RAISE EXCEPTION 'G189 forbidden context' USING ERRCODE='P1891'; END IF;
 SELECT pg_catalog.count(*),(pg_catalog.array_agg(booking_key))[1] INTO n,b
 FROM (SELECT booking_key FROM public.mobility_stage_g100_moto_trips
  WHERE driver_id=_driver AND status IN('accepted','arriving','in_progress')
  LIMIT 2) active;
 IF n=0 THEN RETURN NULL; END IF;
 IF n<>1 THEN
  RAISE EXCEPTION 'G189 ambiguous Driver active MOTO assignment'
   USING ERRCODE='P1892';
 END IF;
 RETURN public.mobility_stage_g169_driver_moto_status_qa(_driver,b);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g189_driver_moto_current_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g189_driver_moto_current_qa(uuid)
 TO service_role;
COMMIT;
