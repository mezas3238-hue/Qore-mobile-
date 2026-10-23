-- G31 A05.5: 121 genuine PostgreSQL zone-service rows, 50/50/21 pages.
-- Synthetic-only telemetry; each actor and row rolls back after assertions.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
  current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G31 zone tests refuse non-disposable DB'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('91919191-9191-4919-8919-919191919191'),
 ('92929292-9292-4929-8929-929292929292'),
 ('93939393-9393-4939-8939-939393939393')
ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN
 ('91919191-9191-4919-8919-919191919191',
  '92929292-9292-4929-8929-929292929292');
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES
 ('91919191-9191-4919-8919-919191919191','admin','active',
  '93939393-9393-4939-8939-939393939393'),
 ('92929292-9292-4929-8929-929292929292','owner','active',
  '93939393-9393-4939-8939-939393939393');

INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status)
SELECT md5('G31_ZONE_'||n)::uuid,'Asuncion','AUTO_RIDE','ACTIVE'
 FROM generate_series(1,120) n;
-- Same zone, different service = a different row, not double-counting autos.
INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status)
 VALUES(md5('G31_ZONE_1')::uuid,'Asuncion','MOTO_DELIVERY','PLANNED');

INSERT INTO public.mobility_stage_g31_zone_observations(
 observation_id,zone_id,service_kind,on_duty_vehicles,observed_at)
 VALUES
 (md5('G31_OBS_FRESH')::uuid,md5('G31_ZONE_1')::uuid,
  'AUTO_RIDE',7,clock_timestamp()-interval '15 seconds'),
 (md5('G31_OBS_STALE')::uuid,md5('G31_ZONE_2')::uuid,
  'AUTO_RIDE',81,clock_timestamp()-interval '10 minutes'),
 (md5('G31_OBS_SIXTY_ONE')::uuid,md5('G31_ZONE_4')::uuid,
  'AUTO_RIDE',42,clock_timestamp()-interval '70 seconds'),
 (md5('G31_OBS_MOTO')::uuid,md5('G31_ZONE_1')::uuid,
  'MOTO_DELIVERY',3,clock_timestamp()-interval '20 seconds');

DO $access$
BEGIN
 IF has_table_privilege('service_role',
  'public.mobility_stage_g31_zone_coverage','INSERT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g31_zone_observations','INSERT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g31_zone_observations','UPDATE')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_g31_zone_coverage','SELECT')
 OR has_table_privilege('anon',
  'public.mobility_stage_g31_zone_observations','SELECT')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g31_admin_zone_page(uuid,bigint,text,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g31_admin_zone_page(uuid,bigint,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G31 private zone/telemetry privileges leaked'; END IF;
END $access$;

SET LOCAL ROLE service_role;
DO $walk$
DECLARE
 actor uuid:='91919191-9191-4919-8919-919191919191';
 anchor_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 cursor text:=NULL;
 batch jsonb; item jsonb; key text; previous text;pages int:=0;total int:=0;
 seen text[]:=ARRAY[]::text[]; fresh_auto int:=0; fresh_moto int:=0;
 stale int:=0; absent int:=0;
BEGIN
 LOOP
  batch:=public.mobility_stage_g31_admin_zone_page(actor,anchor_ms,cursor,50);
  IF jsonb_array_length(batch->'items')>50
  THEN RAISE EXCEPTION 'G31 max-50 page violated'; END IF;
  previous:=NULL;
  FOR item IN SELECT value FROM jsonb_array_elements(batch->'items') LOOP
   IF (SELECT count(*) FROM jsonb_object_keys(item))<>7
   OR item->>'municipality'<>'Asuncion'
   OR item->>'eligibleByPolicy'<>'false'
   OR item->>'coverageStatus' NOT IN ('ACTIVE','PLANNED')
   THEN RAISE EXCEPTION 'G31 fabricated availability, leaked private data or changed policy'; END IF;
   key:=replace(item->>'zoneId','-','')||
    CASE item->>'serviceKind'
     WHEN 'AUTO_RIDE' THEN '0'
     WHEN 'AUTO_DELIVERY' THEN '1'
     WHEN 'MOTO_DELIVERY' THEN '2'
     ELSE 'X' END;
   IF key=ANY(seen) OR (cursor IS NOT NULL AND key>=cursor)
    OR (previous IS NOT NULL AND key>=previous)
   THEN RAISE EXCEPTION 'G31 duplicate or non-descending keyset'; END IF;
   seen:=array_append(seen,key);previous:=key;total:=total+1;
   IF (item->>'zoneId')::uuid=md5('G31_ZONE_1')::uuid AND
    item->>'serviceKind'='AUTO_RIDE' THEN
    IF (item->>'onDutyVehicles')::int<>7 OR
     (item->>'availabilityObservedAt')::bigint<=0
    THEN RAISE EXCEPTION 'G31 fresh AUTO telemetry not source-backed'; END IF;
    fresh_auto:=fresh_auto+1;
   ELSIF (item->>'zoneId')::uuid=md5('G31_ZONE_1')::uuid AND
    item->>'serviceKind'='MOTO_DELIVERY' THEN
    IF (item->>'onDutyVehicles')::int<>3 OR
     (item->>'availabilityObservedAt')::bigint<=0
     OR item->>'coverageStatus'<>'PLANNED'
    THEN RAISE EXCEPTION 'G31 MOTO service/count leaked into AUTO'; END IF;
    fresh_moto:=fresh_moto+1;
   ELSIF (item->>'zoneId')::uuid IN (md5('G31_ZONE_2')::uuid,md5('G31_ZONE_4')::uuid) THEN
    IF item->>'onDutyVehicles'<>'0' OR
       item->>'availabilityObservedAt'<>'0'
    THEN RAISE EXCEPTION 'G31 stale telemetry misrepresented as current'; END IF;
    stale:=stale+1;
   ELSE
    IF item->>'onDutyVehicles'<>'0' OR
       item->>'availabilityObservedAt'<>'0'
    THEN RAISE EXCEPTION 'G31 unsampled zone claimed current presence'; END IF;
    absent:=absent+1;
   END IF;
  END LOOP;
  pages:=pages+1;
  IF (batch->>'hasMore')::boolean THEN
   IF jsonb_array_length(batch->'items')<>50 OR previous IS NULL
   THEN RAISE EXCEPTION 'G31 incomplete continuation'; END IF;
   cursor:=previous;
  ELSE EXIT; END IF;
  IF pages>10 THEN RAISE EXCEPTION 'G31 infinite pages'; END IF;
 END LOOP;
 IF total<>121 OR pages<>3 OR cardinality(seen)<>121
  OR fresh_auto<>1 OR fresh_moto<>1 OR stale<>2 OR absent<>117
 THEN RAISE EXCEPTION 'G31 incomplete: total %, pages %, auto %, moto %, stale %, missing %',
 total,pages,fresh_auto,fresh_moto,stale,absent; END IF;
 RAISE NOTICE 'G31 real zones: % rows in % pages, 2 observed, stale/missing safely unknown',
 total,pages;
END $walk$;
DO $attacks$
DECLARE denied boolean;
BEGIN
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g31_admin_zone_page(
   '92929292-9292-4929-8929-929292929292',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G3101' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G31 Owner crossed Admin zone privilege'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g31_admin_zone_page(
   '91919191-9191-4919-8919-919191919191',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint,'garbage',50);
 EXCEPTION WHEN SQLSTATE 'G3101' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G31 malformed cursor accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g31_admin_zone_page(
   '91919191-9191-4919-8919-919191919191',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint,NULL,51);
 EXCEPTION WHEN SQLSTATE 'G3101' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G31 oversized page accepted'; END IF;
END $attacks$;
RESET ROLE;

INSERT INTO public.user_roles(user_id,role)
 VALUES('91919191-9191-4919-8919-919191919191','passenger');
SET LOCAL ROLE service_role;
DO $dual_role$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g31_admin_zone_page(
   '91919191-9191-4919-8919-919191919191',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G3101' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G31 backoffice dual-role bypass'; END IF;
END $dual_role$;
RESET ROLE;
ROLLBACK;
