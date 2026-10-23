-- G31.2 disposable high-volume test: 30,030 synthetic coverage rows.
-- Exercises all 601 keyset pages, no OFFSET and no global 50-row ceiling.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G31 large volume refuses non-disposable DB'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='240s';
INSERT INTO auth.users(id) VALUES
 ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'),
 ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2')
ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id=
 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
INSERT INTO public.mobility_stage_backoffice_roles(
 user_id,role,status,approved_by
) VALUES(
 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
 'admin','active','a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'
);
INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status)
SELECT md5('G31_SCALE_'||n)::uuid,'Asuncion',
 CASE (n%3)
 WHEN 0 THEN 'MOTO_DELIVERY'
 WHEN 1 THEN 'AUTO_RIDE'
 ELSE 'AUTO_DELIVERY' END,
 'PLANNED'
FROM generate_series(1,30030) n;
ANALYZE public.mobility_stage_g31_zone_coverage;
SET LOCAL ROLE service_role;
DO $huge$
DECLARE
 actor uuid:='a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
 at bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 cursor_key text:=NULL;
 prev text:=NULL;
 last_key text;
 k text;
 result jsonb;
 item jsonb;
 n bigint:=0;pages integer:=0;
 t0 timestamptz:=clock_timestamp();
BEGIN
 LOOP
  result:=public.mobility_stage_g31_admin_zone_page(actor,at,cursor_key,50);
  last_key:=NULL;
  FOR item IN SELECT value FROM jsonb_array_elements(result->'items') LOOP
   k:=replace(item->>'zoneId','-','')||
    CASE item->>'serviceKind'
     WHEN 'AUTO_RIDE' THEN '0'
     WHEN 'AUTO_DELIVERY' THEN '1'
     WHEN 'MOTO_DELIVERY' THEN '2' ELSE 'x' END;
   IF (prev IS NOT NULL AND k>=prev) OR
    (cursor_key IS NOT NULL AND k>=cursor_key)
   THEN RAISE EXCEPTION 'G31 30k keyset repeated or not sorted'; END IF;
   prev:=k;last_key:=k;n:=n+1;
   IF item->>'eligibleByPolicy'<>'false' OR
      item->>'onDutyVehicles'<>'0' OR
      item->>'availabilityObservedAt'<>'0'
   THEN RAISE EXCEPTION 'G31 30k fabricated observed availability'; END IF;
  END LOOP;
  pages:=pages+1;
  IF (result->>'hasMore')::boolean THEN
   IF jsonb_array_length(result->'items')<>50 OR last_key IS NULL
   THEN RAISE EXCEPTION 'G31 30k short continuation'; END IF;
   cursor_key:=last_key;
  ELSE EXIT; END IF;
  IF pages>650 THEN RAISE EXCEPTION 'G31 30k infinite cursor pagination'; END IF;
 END LOOP;
 IF pages<>601 OR n<>30030
 THEN RAISE EXCEPTION 'G31 30k truncated history n %, pages %',n,pages; END IF;
 RAISE NOTICE 'G31 high volume PASS: % zone-service records, % pages, total elapsed ms %',
  n,pages,round(extract(epoch FROM (clock_timestamp()-t0))*1000);
END $huge$;
RESET ROLE;
ROLLBACK;
