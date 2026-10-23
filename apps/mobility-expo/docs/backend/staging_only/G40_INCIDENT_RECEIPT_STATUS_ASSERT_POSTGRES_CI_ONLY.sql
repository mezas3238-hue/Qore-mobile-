-- G40 real PostgreSQL: idempotent receipt, cross-account denied, SOS blocked.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G40 assert refuses real database'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('40400000-0000-4400-8400-000000000001'),
 ('40400000-0000-4400-8400-000000000002')
 ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('40400000-0000-4400-8400-000000000001','passenger'),
 ('40400000-0000-4400-8400-000000000002','passenger')
 ON CONFLICT DO NOTHING;
DO $privs$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_g40_owner_incident_status(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g40_owner_incident_status(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G40 mobile role can bypass JWT source'; END IF;
END $privs$;
SET LOCAL ROLE service_role;
DO $proof$
DECLARE
 owner uuid:='40400000-0000-4400-8400-000000000001';
 stranger uuid:='40400000-0000-4400-8400-000000000002';
 request uuid:='40400000-0000-4400-8400-000000000003';
 job uuid;
 a jsonb;b jsonb;own jsonb;cross jsonb;
 denied boolean;events_count integer;
BEGIN
 job:=public.mobility_stage_auto_demo_request(
  owner,'40400000-0000-4400-8400-000000000004',
  'CENTRO','LAMBRARE','economico');
 a:=public.mobility_stage_g40_report_receipt(
  owner,request,'RIDE',job,'SAFETY','HIGH');
 b:=public.mobility_stage_g40_report_receipt(
  owner,request,'RIDE',job,'SAFETY','HIGH');
 IF a IS NULL OR a<>b OR a->>'receiptStatus'<>'RECEIVED_IN_QA_DATABASE_ONLY'
  OR a->>'state'<>'open' OR (a->>'revision')::integer<>1
  OR a->>'incidentId' IS NULL OR a->>'receiptId' IS NULL
 THEN RAISE EXCEPTION 'G40 receipt missing or replay duplicated'; END IF;
 SELECT count(*) INTO events_count FROM public.mobility_stage_safety_incident_events
 WHERE incident_id=(a->>'incidentId')::uuid;
 IF events_count<>1 THEN RAISE EXCEPTION 'G40 duplicate incident event'; END IF;
 own:=public.mobility_stage_g40_owner_incident_status(
  owner,(a->>'incidentId')::uuid);
 cross:=public.mobility_stage_g40_owner_incident_status(
  stranger,(a->>'incidentId')::uuid);
 IF own<>a OR cross IS NOT NULL
 THEN RAISE EXCEPTION 'G40 status leaked or inconsistent receipt'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g40_report_receipt(
    owner,request,'RIDE',job,'QUALITY','LOW');
 EXCEPTION WHEN SQLSTATE 'G4009' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G40 conflicting requestKey replay allowed'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g40_report_receipt(
    owner,'40400000-0000-4400-8400-000000000005',
    'RIDE',job,'SOS','CRITICAL');
 EXCEPTION WHEN SQLSTATE 'G4003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G40 unverified SOS mistakenly accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g40_report_receipt(
    stranger,'40400000-0000-4400-8400-000000000006',
    'RIDE',job,'SAFETY','LOW');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G40 nonparticipant report accepted'; END IF;
 RAISE NOTICE 'G40 PASS: persisted receipt, one event, stable replay, owner isolation, no SOS';
END $proof$;
RESET ROLE;
ROLLBACK;
