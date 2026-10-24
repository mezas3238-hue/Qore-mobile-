-- G28 A05.3: real PostgreSQL disposable incident pagination + authority attacks.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
    current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G28 incident tests refuse non-disposable DB'; END IF;
 IF to_regprocedure('public.mobility_stage_g28_admin_incident_page(uuid,bigint,text,integer)')
 IS NULL THEN RAISE EXCEPTION 'G28 read RPC unavailable'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
-- No real persons. This transaction rolls back all fixtures.
INSERT INTO auth.users(id) VALUES
 ('67676767-6767-4767-8767-676767676767'::uuid),
 ('68686868-6868-4868-8868-686868686868'::uuid),
 ('69696969-6969-4969-8969-696969696969'::uuid)
ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN (
 '67676767-6767-4767-8767-676767676767'::uuid,
 '68686868-6868-4868-8868-686868686868'::uuid);
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES
 ('67676767-6767-4767-8767-676767676767','admin','active',
  '69696969-6969-4969-8969-696969696969'),
 ('68686868-6868-4868-8868-686868686868','owner','active',
  '69696969-6969-4969-8969-696969696969');

-- Historic records with timestamp ties; 121 rows => 50 + 50 + 21.
INSERT INTO public.mobility_stage_safety_incidents(
 id,request_key,reporter_id,subject_kind,subject_id,category,severity,
 status,revision,created_at,changed_at
)
SELECT md5('G28_INCIDENT_'||n)::uuid,md5('G28_REQUEST_'||n)::uuid,
 '69696969-6969-4969-8969-696969696969'::uuid,
 'RIDE',md5('G28_SUBJECT_'||n)::uuid,
 'SAFETY','HIGH','open',1,
 CASE WHEN n<=60 THEN '2026-10-22T08:00:00Z'::timestamptz
 ELSE '2026-10-22T09:00:00Z'::timestamptz END,
 CASE WHEN n<=60 THEN '2026-10-22T08:00:00Z'::timestamptz
 ELSE '2026-10-22T09:00:00Z'::timestamptz END
FROM generate_series(1,121) AS n;

DO $privileges$
BEGIN
 IF has_function_privilege('anon',
  'public.mobility_stage_g28_admin_incident_page(uuid,bigint,text,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g28_admin_incident_page(uuid,bigint,text,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g28_admin_incident_page(uuid,bigint,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G28 private read RPC privilege leaked'; END IF;
END $privileges$;

CREATE TEMP TABLE g28_seen(id uuid PRIMARY KEY) ON COMMIT DROP;
DO $traversal$
DECLARE
 actor uuid:='67676767-6767-4767-8767-676767676767';
 anchor_ms bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 cursor_key text:=NULL;
 page jsonb;
 item jsonb;
 rows integer:=0;
 pages integer:=0;
 last_key text;
 page_rows integer;
BEGIN
 LOOP
  page:=public.mobility_stage_g28_admin_incident_page(
   actor,anchor_ms,cursor_key,50);
  page_rows:=jsonb_array_length(page->'items');
  IF page_rows>50 THEN RAISE EXCEPTION 'G28 page exceeded 50'; END IF;
  last_key:=NULL;
  FOR item IN SELECT value FROM jsonb_array_elements(page->'items') LOOP
   IF item->>'category'<>'SAFETY' OR item->>'severity'<>'HIGH'
   OR item->>'status'<>'OPEN' OR
      (SELECT count(*) FROM jsonb_object_keys(item))<>6
   THEN RAISE EXCEPTION 'G28 DTO violates B schema'; END IF;
   INSERT INTO g28_seen VALUES((item->>'incidentId')::uuid);
   rows:=rows+1;
   last_key:=lpad(item->>'createdAt',13,'0') ||
    replace(item->>'incidentId','-','');
   IF cursor_key IS NOT NULL AND last_key>=cursor_key
   THEN RAISE EXCEPTION 'G28 cursor did not progress'; END IF;
  END LOOP;
  pages:=pages+1;
  IF (page->>'hasMore')::boolean THEN
   IF page_rows<>50 OR last_key IS NULL
   THEN RAISE EXCEPTION 'G28 invalid next-page contract'; END IF;
   cursor_key:=last_key;
  ELSE
   EXIT;
  END IF;
  IF pages>8 THEN RAISE EXCEPTION 'G28 non-progressing queue'; END IF;
 END LOOP;
 IF rows<>121 OR pages<>3 OR (SELECT count(*) FROM g28_seen)<>121
 THEN RAISE EXCEPTION 'G28 history incomplete %, pages %',rows,pages; END IF;
 RAISE NOTICE 'G28 real incident queue: % owned rows in % pages, no duplicates',
   rows,pages;
END $traversal$;

-- Test effective permission as the actual backend service role.
SET LOCAL ROLE service_role;
DO $authority$
DECLARE
 page jsonb;
 refused boolean;
BEGIN
 page:=public.mobility_stage_g28_admin_incident_page(
  '67676767-6767-4767-8767-676767676767',
  floor(extract(epoch from clock_timestamp())*1000)::bigint,NULL,50);
 IF jsonb_array_length(page->'items')<>50
 THEN RAISE EXCEPTION 'G28 backend service role cannot view authorized page'; END IF;
 refused:=false;
 BEGIN
  PERFORM public.mobility_stage_g28_admin_incident_page(
   '68686868-6868-4868-8868-686868686868',
   floor(extract(epoch from clock_timestamp())*1000)::bigint,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G2801' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'G28 Owner accessed Admin incidents'; END IF;
 refused:=false;
 BEGIN
  PERFORM public.mobility_stage_g28_admin_incident_page(
   '67676767-6767-4767-8767-676767676767',
   floor(extract(epoch from clock_timestamp())*1000)::bigint,'forged',50);
 EXCEPTION WHEN SQLSTATE 'G2801' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'G28 fake cursor accepted'; END IF;
 refused:=false;
 BEGIN
  PERFORM public.mobility_stage_g28_admin_incident_page(
   '67676767-6767-4767-8767-676767676767',
   floor(extract(epoch from clock_timestamp())*1000)::bigint,NULL,51);
 EXCEPTION WHEN SQLSTATE 'G2801' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'G28 unbounded page size accepted'; END IF;
END $authority$;
RESET ROLE;

-- A native passenger role on the same account must deny even a prior
-- active backoffice grant.
INSERT INTO public.user_roles(user_id,role)
VALUES ('67676767-6767-4767-8767-676767676767','passenger');
SET LOCAL ROLE service_role;
DO $dual$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g28_admin_incident_page(
   '67676767-6767-4767-8767-676767676767',
   floor(extract(epoch from clock_timestamp())*1000)::bigint,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G2801' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'G28 dual-role bypass'; END IF;
END $dual$;
RESET ROLE;
ROLLBACK;
