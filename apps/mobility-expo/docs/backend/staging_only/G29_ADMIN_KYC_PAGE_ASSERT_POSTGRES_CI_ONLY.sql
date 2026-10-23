-- G29 A05.4 — query genuine G2 applications + G17 document state.
-- Synthetic row fixtures are rolled back, no personal documents or bytes.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G29 test must use disposable CI PostgreSQL'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('71717171-7171-4717-8717-717171717171'::uuid),
 ('72727272-7272-4727-8727-727272727272'::uuid),
 ('73737373-7373-4737-8737-737373737373'::uuid)
ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN (
 '71717171-7171-4717-8717-717171717171'::uuid,
 '73737373-7373-4737-8737-737373737373'::uuid);
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES ('71717171-7171-4717-8717-717171717171',
 'admin','active','73737373-7373-4737-8737-737373737373');

INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,country_code,
  municipality_code,plate_normalized,brand,model,manufacture_year,
  passenger_capacity,review_status,created_at)
SELECT md5('G29_AUTO_'||n)::uuid,
 '72727272-7272-4727-8727-727272727272'::uuid,
 'AUTO','economico','PY','ASUNCION',
 'Q'||lpad(n::text,8,'0'),'TEST','AUTO',2022,4,'pending',
 '2026-10-22T12:00:00Z'::timestamptz
FROM generate_series(1,121) n;
-- Historic G2 MOTO means passenger; it must NEVER be mislabelled delivery.
INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,country_code,
  municipality_code,plate_normalized,brand,model,manufacture_year,
  passenger_capacity,review_status,created_at)
VALUES (md5('G29_MOTO_NOT_DELIVERY')::uuid,
 '72727272-7272-4727-8727-727272727272'::uuid,
 'MOTO','moto_pasajero','PY','ASUNCION',
 'QMOTO0001','TEST','MOTO',2022,1,'pending',
 '2026-10-22T12:00:00Z'::timestamptz);

-- One synthetically verified private Storage *reference*; no file, URL or PII.
INSERT INTO public.mobility_stage_driver_documents
 (id,request_key,driver_id,kind,storage_bucket,object_key,
  mime_type,byte_size,sha256_hex,status)
VALUES
 (md5('G29_DOC')::uuid,md5('G29_DOC_REQ')::uuid,
 '72727272-7272-4727-8727-727272727272'::uuid,
 'licencia','mobility-staging-driver-evidence',
 '72727272-7272-4727-8727-727272727272/licencia-synthetic123456789012345.jpg',
 'image/jpeg',12345,repeat('a',64),'pending');

DO $priv$
BEGIN
 IF has_function_privilege('anon',
 'public.mobility_stage_g29_admin_kyc_page(uuid,bigint,text,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
 'public.mobility_stage_g29_admin_kyc_page(uuid,bigint,text,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role',
 'public.mobility_stage_g29_admin_kyc_page(uuid,bigint,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G29 private KYC RPC permission leak'; END IF;
END $priv$;

SET LOCAL ROLE service_role;
DO $pages$
DECLARE
 actor uuid:='71717171-7171-4717-8717-717171717171';
 anchor bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 cur text:=NULL;
 r jsonb; itm jsonb; pages integer:=0; total integer:=0; last text;
 seen uuid[]:=ARRAY[]::uuid[];
BEGIN
 LOOP
  r:=public.mobility_stage_g29_admin_kyc_page(actor,anchor,cur,50);
  IF jsonb_array_length(r->'items')>50
  THEN RAISE EXCEPTION 'G29 too many rows per page'; END IF;
  last:=NULL;
  FOR itm IN SELECT value FROM jsonb_array_elements(r->'items') LOOP
   IF (SELECT count(*) FROM jsonb_object_keys(itm))<>7
   OR itm->>'vehicleKind'<>'AUTO'
   OR itm->>'applicationStatus'<>'pending'
   OR itm->>'licenseStatus'<>'pending'
   OR itm->>'insuranceStatus'<>'missing'
   OR itm->>'inspectionStatus'<>'missing'
   OR itm->>'reviewRevision'<>'1'
   THEN RAISE EXCEPTION 'G29 fabricated KYC state or unsafe DTO'; END IF;
   IF (itm->>'vehicleId')::uuid=ANY(seen) THEN
    RAISE EXCEPTION 'G29 duplicate vehicle across pages'; END IF;
   seen:=array_append(seen,(itm->>'vehicleId')::uuid);
   total:=total+1;
   last:=replace(itm->>'vehicleId','-','');
   IF cur IS NOT NULL AND last>=cur
   THEN RAISE EXCEPTION 'G29 non-progress cursor'; END IF;
  END LOOP;
  pages:=pages+1;
  IF (r->>'hasMore')::boolean THEN
   IF jsonb_array_length(r->'items')<>50
   THEN RAISE EXCEPTION 'G29 incomplete page before continuation'; END IF;
   cur:=last;
  ELSE EXIT; END IF;
  IF pages>10 THEN RAISE EXCEPTION 'G29 pagination loop'; END IF;
 END LOOP;
 IF total<>121 OR pages<>3 OR cardinality(seen)<>121
 THEN RAISE EXCEPTION 'G29 incomplete KYC history %, % pages',total,pages; END IF;
 RAISE NOTICE 'G29 KYC real SQL: % rows, % pages, no duplicates, MOTO passenger excluded',
   total,pages;
END $pages$;
RESET ROLE;

-- Suspension and mixed historical passenger assignment deny authorization.
UPDATE public.mobility_stage_backoffice_roles
 SET status='suspended',revision=revision+1
 WHERE user_id='71717171-7171-4717-8717-717171717171';
SET LOCAL ROLE service_role;
DO $suspended$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g29_admin_kyc_page(
   '71717171-7171-4717-8717-717171717171',
   floor(extract(epoch from clock_timestamp())*1000)::bigint,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G2901' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G29 suspended admin accessed KYC'; END IF;
END $suspended$;
RESET ROLE;
UPDATE public.mobility_stage_backoffice_roles
 SET status='active',revision=revision+1
 WHERE user_id='71717171-7171-4717-8717-717171717171';
INSERT INTO public.user_roles(user_id,role) VALUES
 ('71717171-7171-4717-8717-717171717171','passenger');
SET LOCAL ROLE service_role;
DO $mixed$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g29_admin_kyc_page(
   '71717171-7171-4717-8717-717171717171',
   floor(extract(epoch from clock_timestamp())*1000)::bigint,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G2901' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G29 historical Passenger+Admin was authorized'; END IF;
END $mixed$;
RESET ROLE;
ROLLBACK;
