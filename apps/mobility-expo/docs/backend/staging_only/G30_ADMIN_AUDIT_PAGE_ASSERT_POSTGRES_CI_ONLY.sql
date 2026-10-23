-- G30 verified Admin audit events: 121 triage + 1 KYC + 1 suspension.
-- Synthetic transaction ROLLBACK; no actor identities returned to Admin B.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G30 audit assertions refuse non-disposable DB'; END IF;
END $guard$;
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('81818181-8181-4818-8818-818181818181'::uuid),
 ('82828282-8282-4828-8828-828282828282'::uuid),
 ('83838383-8383-4838-8838-838383838383'::uuid),
 ('84848484-8484-4848-8848-848484848484'::uuid)
ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN
 ('81818181-8181-4818-8818-818181818181'::uuid,
  '84848484-8484-4848-8848-848484848484'::uuid);
INSERT INTO public.user_roles(user_id,role)
 VALUES('81818181-8181-4818-8818-818181818181','admin');
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('84848484-8484-4848-8848-848484848484',
 'admin','active','83838383-8383-4838-8838-838383838383');

INSERT INTO public.mobility_stage_safety_incidents
 (id,request_key,reporter_id,subject_kind,subject_id,
 category,severity,status,revision,created_at,changed_at)
SELECT md5('G30_INCIDENT_'||n)::uuid,md5('G30_IR_'||n)::uuid,
 '82828282-8282-4828-8828-828282828282',
 'RIDE',md5('G30_SUB_'||n)::uuid,
 'SAFETY','HIGH','triaged',2,
 '2026-10-22T07:00:00Z'::timestamptz,'2026-10-22T08:00:00Z'::timestamptz
FROM generate_series(1,121) n;
INSERT INTO public.mobility_stage_safety_incident_events
 (id,request_key,incident_id,actor_id,action,reason_code,
 next_status,incident_revision,recorded_at)
SELECT md5('G30_EVENT_'||n)::uuid,md5('G30_ER_'||n)::uuid,
 md5('G30_INCIDENT_'||n)::uuid,
 '81818181-8181-4818-8818-818181818181',
 'triage','QA_TRIAGE','triaged',2,
 '2026-10-22T08:00:00Z'::timestamptz
FROM generate_series(1,121) n;

INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,country_code,
 municipality_code,plate_normalized,brand,model,manufacture_year,passenger_capacity)
VALUES(md5('G30_VEHICLE')::uuid,
 '82828282-8282-4828-8828-828282828282',
 'AUTO','economico','PY','ASUNCION','QA3000001','TEST','CAR',2020,4);
INSERT INTO public.mobility_vehicle_review_audit
 (id,request_key,vehicle_id,reviewer_id,new_status,
 vehicle_revision,reason,reviewed_at)
VALUES(md5('G30_VEVENT')::uuid,md5('G30_VREQ')::uuid,
 md5('G30_VEHICLE')::uuid,
 '81818181-8181-4818-8818-818181818181',
 'approved',2,'Synthetic QA review only','2026-10-22T08:00:00Z');

INSERT INTO public.mobility_stage_operational_suspensions
 (id,request_key,subject_user_id,scope,reason_code,
 applied_by,applied_at,active,revision)
VALUES(md5('G30_SUSP')::uuid,md5('G30_SREQ')::uuid,
 '82828282-8282-4828-8828-828282828282',
 'DRIVER','QA_SUSPEND',
 '81818181-8181-4818-8818-818181818181',
 '2026-10-22T08:00:00Z',true,1);
INSERT INTO public.mobility_stage_suspension_events
 (id,request_key,suspension_id,actor_id,action,
 reason_code,suspension_revision,recorded_at)
VALUES(md5('G30_SEVENT')::uuid,md5('G30_SEREQ')::uuid,
 md5('G30_SUSP')::uuid,
 '81818181-8181-4818-8818-818181818181',
 'apply','QA_SUSPEND',1,'2026-10-22T08:00:00Z');

DO $priv$
BEGIN
 IF has_function_privilege('anon',
  'public.mobility_stage_g30_admin_audit_page(uuid,bigint,text,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g30_admin_audit_page(uuid,bigint,text,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g30_admin_audit_page(uuid,bigint,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G30 audit read privilege leaked'; END IF;
END $priv$;
SET LOCAL ROLE service_role;
DO $page_test$
DECLARE
 actor uuid:='84848484-8484-4848-8848-848484848484';
 anchor bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 pos text:=NULL;
 batch jsonb; e jsonb; pages integer:=0; total integer:=0;
 all_ids uuid[]:=ARRAY[]::uuid[];last text;
 ntriage integer:=0;nkyc integer:=0;nsusp integer:=0;
BEGIN
 LOOP
  batch:=public.mobility_stage_g30_admin_audit_page(actor,anchor,pos,50);
  IF jsonb_array_length(batch->'items')>50
  THEN RAISE EXCEPTION 'G30 page >50'; END IF;
  last:=NULL;
  FOR e IN SELECT value FROM jsonb_array_elements(batch->'items') LOOP
   IF (SELECT count(*) FROM jsonb_object_keys(e))<>7
   OR e->>'actorRole'<>'admin' OR e->>'outcome'<>'CONFIRMED'
   OR e->>'targetKind' NOT IN ('INCIDENT','VEHICLE','ACCOUNT')
   OR (e->>'eventId')::uuid=ANY(all_ids)
   THEN RAISE EXCEPTION 'G30 unsafe duplicate/actor/PII event'; END IF;
   all_ids:=array_append(all_ids,(e->>'eventId')::uuid);
   total:=total+1;
   last:=lpad(e->>'occurredAt',13,'0')||replace(e->>'eventId','-','');
   IF pos IS NOT NULL AND last>=pos
   THEN RAISE EXCEPTION 'G30 cursor failed to advance'; END IF;
   IF e->>'operation'='INCIDENT_TRIAGE' THEN ntriage:=ntriage+1;
   ELSIF e->>'operation'='KYC_REVIEW' THEN nkyc:=nkyc+1;
   ELSIF e->>'operation'='ACCOUNT_SUSPEND' THEN nsusp:=nsusp+1;
   ELSE RAISE EXCEPTION 'G30 unsupported operation appeared'; END IF;
  END LOOP;
  pages:=pages+1;
  IF (batch->>'hasMore')::boolean THEN
   IF jsonb_array_length(batch->'items')<>50
   THEN RAISE EXCEPTION 'G30 incomplete intermediate page'; END IF;
   pos:=last;
  ELSE EXIT; END IF;
  IF pages>10 THEN RAISE EXCEPTION 'G30 loop'; END IF;
 END LOOP;
 IF total<>123 OR pages<>3 OR ntriage<>121 OR nkyc<>1 OR nsusp<>1
 THEN RAISE EXCEPTION 'G30 audit incomplete total %, pages %, triage %, KYC %, suspension %',
 total,pages,ntriage,nkyc,nsusp; END IF;
 RAISE NOTICE 'G30 genuine SQL audit: % operations, % pages, 3 source classes',total,pages;
END $page_test$;
DO $deny$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g30_admin_audit_page(
   '81818181-8181-4818-8818-818181818181',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G3001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G30 historical native Admin bypassed backoffice Auth'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g30_admin_audit_page(
   '84848484-8484-4848-8848-848484848484',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint,'fake',50);
 EXCEPTION WHEN SQLSTATE 'G3001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G30 forged keyset accepted'; END IF;
END $deny$;
RESET ROLE;
ROLLBACK;
