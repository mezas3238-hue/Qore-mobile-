-- G248: persistent resume + multi-instance exclusion, PostgreSQL16 disposable.
-- No network scheduler and NO external STAGING/production migration.
-- This depends on G247's independently verified private outbox and owner scan.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g247_scan_expiry_owner_qa(uuid,integer)') IS NULL
 OR to_regclass('public.mobility_stage_g248_expiry_scan_state_qa') IS NOT NULL
 THEN RAISE EXCEPTION 'G248 requires isolated G247 CI evidence' USING ERRCODE='P7480'; END IF;
END $guard$;

CREATE TABLE public.mobility_stage_g248_expiry_scan_state_qa (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 resume_document_id uuid,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 last_processed_at timestamptz,
 last_completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
INSERT INTO public.mobility_stage_g248_expiry_scan_state_qa(singleton) VALUES(true);
ALTER TABLE public.mobility_stage_g248_expiry_scan_state_qa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g248_expiry_scan_state_qa
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g248_run_due_kyc_batch_owner_qa(
 _limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 checkpoint public.mobility_stage_g248_expiry_scan_state_qa%ROWTYPE;
 result jsonb;
 last_cursor uuid;
 completed boolean;
 new_revision bigint;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _limit IS NULL OR _limit<1 OR _limit>50
 THEN RAISE EXCEPTION 'G248 refuses production, malformed or unbounded job'
 USING ERRCODE='P7481'; END IF;

 -- Durable singleton row locks out concurrent workers even across Railway
 -- replicas. On transaction failure, both outbox and cursor roll back.
 SELECT * INTO checkpoint
 FROM public.mobility_stage_g248_expiry_scan_state_qa
 WHERE singleton=true FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g248_expiry_scan_state_qa
     WHERE singleton=true)
  THEN RAISE EXCEPTION 'G248 cursor state missing' USING ERRCODE='P7482'; END IF;
  RETURN pg_catalog.jsonb_build_object(
   'mode','STAGING_DEMO_ONLY','status','BUSY','qaOnly',true,
   'productionEnabled',false,'driverDispatchAuthorized',false);
 END IF;
 result:=public.mobility_stage_g247_scan_expiry_owner_qa(
  checkpoint.resume_document_id,_limit);
 IF result->>'mode'<>'STAGING_DEMO_ONLY'
 OR result->>'qaOnly'<>'true'
 OR result->>'productionEnabled'<>'false'
 OR result->>'driverDispatchAuthorized'<>'false'
 OR (result->>'processed')::integer<0
 OR (result->>'processed')::integer>_limit
 OR (result->>'inserted')::integer+(result->>'duplicate')::integer
  <>(result->>'processed')::integer
 THEN RAISE EXCEPTION 'G248 untrusted inner scan' USING ERRCODE='P7483'; END IF;

 last_cursor:=NULLIF(result->>'nextCursor','')::uuid;
 completed:=last_cursor IS NULL;
 UPDATE public.mobility_stage_g248_expiry_scan_state_qa
 SET resume_document_id=last_cursor,revision=revision+1,
  last_processed_at=pg_catalog.clock_timestamp(),
  last_completed_at=CASE WHEN completed THEN pg_catalog.clock_timestamp()
    ELSE last_completed_at END,
  updated_at=pg_catalog.clock_timestamp()
 WHERE singleton=true
 RETURNING revision INTO new_revision;

 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','status','PROCESSED',
  'processed',(result->>'processed')::integer,
  'inserted',(result->>'inserted')::integer,
  'duplicate',(result->>'duplicate')::integer,
  'cycleCompleted',completed,
  'resumeCursor',last_cursor::text,
  'checkpointRevision',new_revision,
  'qaOnly',true,'productionEnabled',false,
  'driverDispatchAuthorized',false);
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g248_run_due_kyc_batch_owner_qa(
 integer) FROM PUBLIC,anon,authenticated,service_role;
