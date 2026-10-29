-- G214: use original G198 and G200 completed-trip private cases
-- created by earlier QA tests. Privileged setup resets case state inside
-- ROLLBACK ONLY; the service role never gets private table permissions.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR NOT pg_catalog.has_function_privilege('service_role',
  'public.mobility_stage_g214_close_g198_case_qa(uuid,uuid,uuid,bigint,boolean)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role',
  'public.mobility_stage_g214_close_g200_case_qa(uuid,uuid,uuid,bigint,boolean)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
  'public.mobility_stage_g214_close_g198_case_qa(uuid,uuid,uuid,bigint,boolean)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
  'public.mobility_stage_g214_close_g200_case_qa(uuid,uuid,uuid,bigint,boolean)','EXECUTE')
 OR pg_catalog.has_table_privilege('service_role',
  'public.mobility_stage_g200_lost_item_cases','SELECT')
 THEN RAISE EXCEPTION 'G214 private close SQL privilege fence broken'; END IF;
END $guard$;
BEGIN;
DO $setup$
DECLARE a uuid;m uuid;
BEGIN
 SELECT case_id INTO a FROM public.mobility_stage_g198_lost_item_cases
 WHERE passenger_id='10900000-0000-4109-8109-000000000021'
 AND trip_id='19800000-0000-4198-8198-000000000021' LIMIT 1;
 SELECT case_id INTO m FROM public.mobility_stage_g200_lost_item_cases
 WHERE passenger_id='19900000-0000-4199-8199-000000000021' LIMIT 1;
 IF a IS NULL OR m IS NULL THEN
  RAISE EXCEPTION 'G214 original AUTO/MOTO lost-case fixture missing'; END IF;
 UPDATE public.mobility_stage_g198_lost_item_cases
 SET state='OPEN',closed_at=NULL WHERE case_id=a;
 UPDATE public.mobility_stage_g200_lost_item_cases
 SET state='OPEN',closed_at=NULL WHERE case_id=m;
 -- Test-only original identifiers are stored in this SQL transaction.
 PERFORM pg_catalog.set_config('qore.g214_auto_case',a::text,true);
 PERFORM pg_catalog.set_config('qore.g214_moto_case',m::text,true);
END $setup$;
SET LOCAL ROLE service_role;
DO $check$
DECLARE a uuid:=pg_catalog.current_setting('qore.g214_auto_case')::uuid;
 m uuid:=pg_catalog.current_setting('qore.g214_moto_case')::uuid;
 v jsonb;denied boolean:=false;
 iat bigint:=(extract(epoch FROM pg_catalog.clock_timestamp()-interval '20 seconds')*1000)::bigint;
BEGIN
 -- Original case identifiers are captured by the isolated database owner.
 -- This application role cannot SELECT the underlying case tables.
 IF a IS NULL OR m IS NULL THEN RAISE EXCEPTION 'G214 original source unknown'; END IF;
 v:=public.mobility_stage_g214_close_g198_case_qa(
  a,'10900000-0000-4109-8109-000000000021',
  '19800000-0000-4198-8198-000000000031',iat,false);
 IF v->>'caseId'<>a::text OR v->>'state'<>'CLOSED'
 OR v->>'productionEnabled'<>'false' OR v ? 'passengerPhone'
 THEN RAISE EXCEPTION 'G214 AUTO failed atomic close proof: %',v; END IF;
 v:=public.mobility_stage_g214_close_g200_case_qa(
  m,'19900000-0000-4199-8199-000000000021',
  '20000000-0000-4200-8200-000000000001',iat,true);
 IF v->>'caseId'<>m::text OR v->>'state'<>'BLOCKED'
 OR v->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G214 MOTO failed atomic block proof: %',v; END IF;
 BEGIN
  PERFORM public.mobility_stage_g214_close_g200_case_qa(
   m,'19900000-0000-4199-8199-000000000021',
   '20000000-0000-4200-8200-000000000001',iat,false);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN
  RAISE EXCEPTION 'G214 forged BLOCKED case reopened'; END IF;
 RAISE NOTICE 'G214 PASS: original AUTO and MOTO lost cases closed/read-backed inside same SQL, BLOCKED remains terminal, no LIVE or private grants';
END $check$;
RESET ROLE;
ROLLBACK;
