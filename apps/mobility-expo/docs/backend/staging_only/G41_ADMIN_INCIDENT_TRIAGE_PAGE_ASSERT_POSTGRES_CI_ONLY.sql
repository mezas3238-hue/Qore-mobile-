-- G41 real PG tests: 241 records, filter BEFORE 50-row cap, Admin isolation.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g41_admin_incident_triage_page(uuid,bigint,text,integer,text,text)') IS NULL
 THEN RAISE EXCEPTION 'G41 test refuses non-disposable DB'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('41414141-4141-4141-8141-414141414141'),
 ('42424242-4242-4242-8242-424242424242'),
 ('43434343-4343-4343-8343-434343434343')
ON CONFLICT DO NOTHING;
-- auth fixture trigger may create a native passenger account. An exclusive
-- Admin must NOT possess a native role; mirror the proven G28 fixture.
DELETE FROM public.user_roles WHERE user_id IN (
 '41414141-4141-4141-8141-414141414141'::uuid,
 '42424242-4242-4242-8242-424242424242'::uuid);
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES
 ('41414141-4141-4141-8141-414141414141','admin','active',
  '43434343-4343-4343-8343-434343434343'),
 ('42424242-4242-4242-8242-424242424242','owner','active',
  '43434343-4343-4343-8343-434343434343');
INSERT INTO public.mobility_stage_safety_incidents(
 id,request_key,reporter_id,subject_kind,subject_id,
 category,severity,status,revision,created_at,changed_at
)
SELECT md5('G41_INCIDENT_'||n)::uuid,md5('G41_REQUEST_'||n)::uuid,
 '43434343-4343-4343-8343-434343434343'::uuid,
 'RIDE',md5('G41_SUBJECT_'||n)::uuid,
 'SAFETY',CASE n%4 WHEN 0 THEN 'CRITICAL'::public.mobility_stage_incident_severity
 WHEN 1 THEN 'HIGH'::public.mobility_stage_incident_severity
 WHEN 2 THEN 'MEDIUM'::public.mobility_stage_incident_severity
 ELSE 'LOW'::public.mobility_stage_incident_severity END,
 CASE WHEN n%3=0 THEN 'open'::public.mobility_stage_incident_status
 ELSE 'triaged'::public.mobility_stage_incident_status END,
 1,'2026-10-22T08:00:00Z'::timestamptz+(n%9)*interval '1 second',
 '2026-10-22T08:00:00Z'::timestamptz+(n%9)*interval '1 second'
FROM generate_series(1,241) n;

DO $grants$
BEGIN
 IF has_function_privilege('anon',
  'public.mobility_stage_g41_admin_incident_triage_page(uuid,bigint,text,integer,text,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g41_admin_incident_triage_page(uuid,bigint,text,integer,text,text)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g41_admin_incident_triage_page(uuid,bigint,text,integer,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'G41 filtered incident RPC privileges leaked'; END IF;
END $grants$;

CREATE TEMP TABLE g41_seen(id uuid PRIMARY KEY) ON COMMIT DROP;
DO $traverse$
DECLARE
 actor uuid:='41414141-4141-4141-8141-414141414141';
 anchor bigint:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 sever text;state text;lastkey text;prior text;page jsonb;record jsonb;
 count_rows integer;page_count integer;expected_rows integer;
 currkey text;rank text;
BEGIN
 FOR sever,state IN SELECT * FROM (VALUES
   (NULL::text,NULL::text),( 'CRITICAL',NULL::text),
   (NULL::text,'OPEN'),('CRITICAL','OPEN'),('LOW','TRIAGED')
 ) filter(sever,state)
 LOOP
  TRUNCATE g41_seen;
  lastkey:=NULL;prior:=NULL;count_rows:=0;page_count:=0;
  LOOP
   page:=public.mobility_stage_g41_admin_incident_triage_page(
    actor,anchor,lastkey,50,sever,state);
   page_count:=page_count+1;
   IF pg_catalog.jsonb_array_length(page->'items')>50
    THEN RAISE EXCEPTION 'G41 exceeded per-page limit'; END IF;
   FOR record IN SELECT value FROM pg_catalog.jsonb_array_elements(page->'items') LOOP
    IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(record))<>6
     OR (sever IS NOT NULL AND record->>'severity'<>sever)
     OR (state IS NOT NULL AND record->>'status'<>state)
    THEN RAISE EXCEPTION 'G41 leaks row outside server filter'; END IF;
    rank:=CASE record->>'severity'
     WHEN 'CRITICAL' THEN '4' WHEN 'HIGH' THEN '3'
     WHEN 'MEDIUM' THEN '2' ELSE '1' END;
    currkey:=rank||pg_catalog.lpad(record->>'createdAt',13,'0')||
      pg_catalog.replace(record->>'incidentId','-','');
    IF prior IS NOT NULL AND currkey>=prior
    THEN RAISE EXCEPTION 'G41 unstable global priority/keyset order'; END IF;
    prior:=currkey;
    INSERT INTO g41_seen VALUES((record->>'incidentId')::uuid);
    count_rows:=count_rows+1;
   END LOOP;
   IF (page->>'hasMore')::boolean THEN
    IF pg_catalog.jsonb_array_length(page->'items')<>50 OR prior IS NULL
    THEN RAISE EXCEPTION 'G41 invalid continuation'; END IF;
    lastkey:=prior;
   ELSE EXIT; END IF;
   IF page_count>10 THEN RAISE EXCEPTION 'G41 pagination did not converge'; END IF;
  END LOOP;
  SELECT count(*) INTO expected_rows
  FROM public.mobility_stage_safety_incidents i
  WHERE i.request_key IN (
    SELECT md5('G41_REQUEST_'||n)::uuid FROM generate_series(1,241) n
  ) AND (sever IS NULL OR i.severity::text=sever)
    AND (state IS NULL OR upper(i.status::text)=state);
  IF count_rows<>expected_rows OR (SELECT count(*) FROM g41_seen)<>expected_rows
  THEN RAISE EXCEPTION 'G41 incomplete filtered set % vs %',count_rows,expected_rows; END IF;
  IF sever IS NULL AND state IS NULL AND (count_rows<>241 OR page_count<>5)
  THEN RAISE EXCEPTION 'G41 global queue hides older incidents'; END IF;
  IF sever='CRITICAL' AND state IS NULL AND page_count<>2
  THEN RAISE EXCEPTION 'G41 CRITICAL cases not traversed globally'; END IF;
  RAISE NOTICE 'G41 filter severity=% status=%: % cases in % pages',
   COALESCE(sever,'ALL'),COALESCE(state,'ALL'),count_rows,page_count;
 END LOOP;
END $traverse$;
SET LOCAL ROLE service_role;
DO $attacks$
DECLARE refused boolean;pg jsonb;
BEGIN
 pg:=public.mobility_stage_g41_admin_incident_triage_page(
  '41414141-4141-4141-8141-414141414141',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
  NULL,50,'CRITICAL','OPEN');
 IF (pg->>'hasMore')::boolean OR jsonb_array_length(pg->'items')=0
 THEN RAISE EXCEPTION 'G41 active Admin cannot read selected source'; END IF;
 FOR refused IN SELECT true LOOP
  BEGIN
   PERFORM public.mobility_stage_g41_admin_incident_triage_page(
    '42424242-4242-4242-8242-424242424242',
    floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
    NULL,50,NULL,NULL);
   RAISE EXCEPTION 'G41 Owner bypassed Admin';
  EXCEPTION WHEN SQLSTATE 'G4101' THEN NULL; END;
  BEGIN
   PERFORM public.mobility_stage_g41_admin_incident_triage_page(
    '41414141-4141-4141-8141-414141414141',
    floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
    '4'||repeat('x',45),50,'CRITICAL',NULL);
   RAISE EXCEPTION 'G41 malformed keyset accepted';
  EXCEPTION WHEN SQLSTATE 'G4101' THEN NULL; END;
  BEGIN
   PERFORM public.mobility_stage_g41_admin_incident_triage_page(
    '41414141-4141-4141-8141-414141414141',
    floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
    NULL,51,NULL,NULL);
   RAISE EXCEPTION 'G41 invalid limit accepted';
  EXCEPTION WHEN SQLSTATE 'G4101' THEN NULL; END;
  BEGIN
   PERFORM public.mobility_stage_g41_admin_incident_triage_page(
    '41414141-4141-4141-8141-414141414141',
    floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
    NULL,50,'EXTREME',NULL);
   RAISE EXCEPTION 'G41 unknown severity accepted';
  EXCEPTION WHEN SQLSTATE 'G4101' THEN NULL; END;
 END LOOP;
END $attacks$;
RESET ROLE;
ROLLBACK;
