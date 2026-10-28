-- G44 PG16 QA: branch mapping, 205 catalog rows / 3 pages,
-- unique session, stale revision, non-buyer denial and no public grants.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g44_buyer_catalog_page(uuid,uuid,bigint,uuid,bigint,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'G44 assertions refuse non-disposable/incomplete schema'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='90s';
INSERT INTO auth.users(id) VALUES
 ('44440000-0000-4444-8444-000000000001'),
 ('44440000-0000-4444-8444-000000000002'),
 ('44440000-0000-4444-8444-000000000003'),
 ('44440000-0000-4444-8444-000000000004')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('44440000-0000-4444-8444-000000000001','passenger'),
 ('44440000-0000-4444-8444-000000000002','passenger')
ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind
) VALUES(
 '44440000-0000-4444-8444-000000000001',
 '44440000-0000-4444-8444-000000000101',
 clock_timestamp()-interval '1 hour',clock_timestamp()-interval '2 minutes',
 clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status
) VALUES('44440000-0000-4444-8444-000000000010','Asuncion','AUTO_DELIVERY','ACTIVE');
INSERT INTO public.mobility_stage_merchants(
 id,onboarding_key,owner_id,kind,display_tag,status,reviewed_by,reviewed_at
) VALUES(
 '44440000-0000-4444-8444-000000000020',
 '44440000-0000-4444-8444-000000000021',
 '44440000-0000-4444-8444-000000000002',
 'SUPERMARKET','TEST_SHOP','approved',
 '44440000-0000-4444-8444-000000000003',clock_timestamp());
INSERT INTO public.mobility_stage_merchant_branches(
 id,merchant_id,branch_tag,pickup_tag,preparation_minutes,active,accepting_orders
) VALUES(
 '44440000-0000-4444-8444-000000000030',
 '44440000-0000-4444-8444-000000000020',
 'TEST_BRANCH','TEST_PICKUP',10,true,true);
INSERT INTO public.mobility_stage_g44_branch_geography(branch_id,zone_id,service_kind)
VALUES(
 '44440000-0000-4444-8444-000000000030',
 '44440000-0000-4444-8444-000000000010','AUTO_DELIVERY');
INSERT INTO public.mobility_stage_catalog_items(
 id,branch_id,sku,item_tag,item_class,unit_price_pyg,unit_grams,stock_units
) SELECT
 ('44440000-0000-4444-8444-'||lpad(g::text,12,'0'))::uuid,
 '44440000-0000-4444-8444-000000000030',
 'SKU_'||g,'PRODUCT_'||g,'GENERAL',1000+g,300,10
 FROM generate_series(1000,1204) g;
DO $tests$
DECLARE
 buyer uuid:='44440000-0000-4444-8444-000000000001';
 session uuid:='44440000-0000-4444-8444-000000000101';
 branch uuid:='44440000-0000-4444-8444-000000000030';
 now_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 a jsonb;b jsonb;c jsonb;discovery jsonb;version bigint;denied boolean:=false;
BEGIN
 IF has_function_privilege('anon',
  'public.mobility_stage_g44_buyer_catalog_page(uuid,uuid,bigint,uuid,bigint,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g44_buyer_catalog_page(uuid,uuid,bigint,uuid,bigint,uuid,integer)','EXECUTE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g44_branch_geography','INSERT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g44_catalog_versions','UPDATE')
 THEN RAISE EXCEPTION 'G44 session/read version grants leaked'; END IF;
 SET LOCAL ROLE service_role;
 discovery:=public.mobility_stage_g44_buyer_branches_page(
 buyer,session,now_ms,'Asuncion','AUTO_DELIVERY',NULL,100);
 IF jsonb_array_length(discovery->'items')<>1
 OR discovery#>>'{items,0,branchId}'<>branch::text
 OR (discovery#>>'{items,0,orderEnabled}')<>'false'
 THEN RAISE EXCEPTION 'G44 authorized QA-only mapped branch discovery failed'; END IF;
 a:=public.mobility_stage_g44_buyer_catalog_page(
 buyer,session,now_ms,branch,NULL,NULL,100);
 version:=(a->>'version')::bigint;
 b:=public.mobility_stage_g44_buyer_catalog_page(
 buyer,session,now_ms,branch,version,
 (a#>>'{items,99,itemId}')::uuid,100);
 c:=public.mobility_stage_g44_buyer_catalog_page(
 buyer,session,now_ms,branch,version,
 (b#>>'{items,99,itemId}')::uuid,100);
 IF jsonb_array_length(a->'items')<>100
 OR jsonb_array_length(b->'items')<>100
 OR jsonb_array_length(c->'items')<>5
 OR (a->>'hasMore')<>'true' OR (b->>'hasMore')<>'true'
 OR (c->>'hasMore')<>'false'
 OR (a->>'orderEnabled')<>'false'
 OR (a->>'eligibleByPolicy')<>'false'
 OR version<2
 THEN RAISE EXCEPTION 'G44 205 catalog products not exhaustively paginated'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g44_buyer_catalog_page(
   '44440000-0000-4444-8444-000000000002',
   session,now_ms,branch,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G4401' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G44 actor spoof bypassed session lock'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g44_buyer_catalog_page(
    buyer,session,now_ms,branch,NULL,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G4401' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G44 accepted non-contract page size'; END IF;
 RESET ROLE;
 UPDATE public.mobility_stage_catalog_items
 SET stock_units=stock_units-1 WHERE id=
  '44440000-0000-4444-8444-000000001000';
 SET LOCAL ROLE service_role;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g44_buyer_catalog_page(
    buyer,session,now_ms,branch,version,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G4409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G44 stale catalog revision accepted'; END IF;
 RESET ROLE;
 RAISE NOTICE 'G44 PASS 205 items, three pages, revocation, actor, version and read-only';
END $tests$;
ROLLBACK;
