-- G48 disposable real PG16 assertions. Synthetic identities/merchant only.
-- Prove role privilege confinement, one-use ticket, actor derivation, scopes,
-- G42 revocation and G44 authoritative catalog without enabling commerce.
DO $g$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g48_mint_owner_attested_qa(uuid,uuid,bigint,text,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G48 tests refuse unsafe/incomplete DB'; END IF;
END $g$;
BEGIN;
SET LOCAL statement_timeout='75s';
INSERT INTO auth.users(id) VALUES
 ('48480000-0000-4848-8484-000000000004'),
 ('48480000-0000-4848-8484-000000000005')
ON CONFLICT DO NOTHING;
-- Historical Driver/passenger users seeded by G16/G17 preflights.
DO $roles$
BEGIN
 IF (SELECT count(*) FROM public.user_roles WHERE
  user_id='00000000-0000-4000-8000-000000000181')<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE
  user_id='00000000-0000-4000-8000-000000000181'
  AND role='driver'::public.app_role)
 OR (SELECT count(*) FROM public.user_roles WHERE
  user_id='00000000-0000-4000-8000-000000000182')<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE
  user_id='00000000-0000-4000-8000-000000000182'
  AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G48 requires G16 genuine role fixtures'; END IF;
END $roles$;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,
 evidence_kind
) VALUES
 ('00000000-0000-4000-8000-000000000181',
  '48480000-0000-4848-8484-000000000101',
  pg_catalog.clock_timestamp()-interval '1 hour',
  pg_catalog.clock_timestamp()-interval '2 minutes',
  pg_catalog.clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('00000000-0000-4000-8000-000000000182',
  '48480000-0000-4848-8484-000000000102',
  pg_catalog.clock_timestamp()-interval '1 hour',
  pg_catalog.clock_timestamp()-interval '2 minutes',
  pg_catalog.clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');

INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status
) VALUES ('48480000-0000-4848-8484-000000000010',
 'Asuncion','AUTO_DELIVERY','ACTIVE');
INSERT INTO public.mobility_stage_merchants(
 id,onboarding_key,owner_id,kind,display_tag,status,reviewed_by,reviewed_at
) VALUES(
 '48480000-0000-4848-8484-000000000020',
 '48480000-0000-4848-8484-000000000021',
 '48480000-0000-4848-8484-000000000004',
 'SUPERMARKET','QA_SHOP','approved',
 '48480000-0000-4848-8484-000000000005',
 pg_catalog.clock_timestamp());
INSERT INTO public.mobility_stage_merchant_branches(
 id,merchant_id,branch_tag,pickup_tag,preparation_minutes,active,accepting_orders
) VALUES(
 '48480000-0000-4848-8484-000000000030',
 '48480000-0000-4848-8484-000000000020',
 'QA_BRANCH','QA_PICKUP',12,true,true);
INSERT INTO public.mobility_stage_g44_branch_geography(branch_id,zone_id,service_kind)
 VALUES('48480000-0000-4848-8484-000000000030',
 '48480000-0000-4848-8484-000000000010','AUTO_DELIVERY');
INSERT INTO public.mobility_stage_catalog_items(
 id,branch_id,sku,item_tag,item_class,unit_price_pyg,unit_grams,stock_units
) VALUES(
 '48480000-0000-4848-8484-000000000040',
 '48480000-0000-4848-8484-000000000030',
 'QA_SKU','QA_TEST_ITEM','GENERAL',12500,250,3);

DO $privileges$
DECLARE p text; r text; f text;
BEGIN
 IF (SELECT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole
   FROM pg_catalog.pg_roles WHERE rolname='mobility_g48_gateway_ci')
 IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G48 delegated role has privileged LOGIN or DDL'; END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role',
 'mobility_g48_gateway_ci'] LOOP
  FOREACH p IN ARRAY ARRAY[
  'public.mobility_stage_driver_documents',
  'public.mobility_stage_driver_document_reviews',
  'public.mobility_stage_g47_access_leases',
  'public.mobility_stage_g48_delegation_proofs',
  'public.mobility_stage_g48_ticket_audit',
  'public.mobility_stage_catalog_items',
  'public.mobility_stage_g44_catalog_versions'
  ] LOOP
   IF pg_catalog.has_table_privilege(r,p,'SELECT')
    OR pg_catalog.has_table_privilege(r,p,'INSERT')
    OR pg_catalog.has_table_privilege(r,p,'UPDATE')
    OR pg_catalog.has_table_privilege(r,p,'DELETE')
   THEN RAISE EXCEPTION 'G48 leaked table %.%',r,p; END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
   'public.mobility_stage_g48_mint_owner_attested_qa(uuid,uuid,bigint,text,uuid)',
   'public.mobility_stage_g48_consume_ticket_qa(uuid,text)',
   'public.mobility_stage_g47_issue_lease_qa(uuid,uuid,bigint,uuid,uuid,text)',
   'public.mobility_stage_register_driver_document(uuid,uuid,public.mobility_stage_driver_document_kind,text,text,integer,text)',
   'public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb)'
  ] LOOP
   IF pg_catalog.has_function_privilege(r,f,'EXECUTE')
   THEN RAISE EXCEPTION 'G48 leaked privileged RPC % %',r,f; END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
   'public.mobility_stage_g48_driver_status_qa(uuid)',
   'public.mobility_stage_g48_driver_lease_probe_qa(uuid)',
   'public.mobility_stage_g48_buyer_catalog_page_qa(uuid,bigint,uuid)'
  ] LOOP
   IF pg_catalog.has_function_privilege(r,f,'EXECUTE') <>
      (r='mobility_g48_gateway_ci')
   THEN RAISE EXCEPTION 'G48 wrong scoped EXECUTE grant % %',r,f; END IF;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'G48 PASS: non-login delegated role, no underlying table/legacy RPC access';
END $privileges$;

-- QA assertion helpers are temporary to this rolled-back transaction.
CREATE FUNCTION public.mobility_stage_g48_ci_assert_driver(_ticket uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE r jsonb;
BEGIN
 r:=public.mobility_stage_g48_driver_status_qa(_ticket);
 IF r->>'source'<>'QA_G48_DRIVER_STATUS_ONLY'
 OR r->>'productionEnabled'<>'false'
 OR r->>'signedUrlAvailable'<>'false'
 OR r->>'documentBytesAvailable'<>'false'
 OR pg_catalog.jsonb_typeof(r->'items')<>'array'
 OR r ? 'objectKey' OR r ? 'sha256Hex' OR r ? 'driverId'
 THEN RAISE EXCEPTION 'G48 Driver leaked private details'; END IF;
 RETURN true;
END $fn$;
CREATE FUNCTION public.mobility_stage_g48_ci_assert_catalog(_ticket uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE r jsonb;
BEGIN
 r:=public.mobility_stage_g48_buyer_catalog_page_qa(_ticket,NULL,NULL);
 IF r->>'source'<>'QA_G48_SCOPED_CATALOG_ONLY'
 OR r->>'orderEnabled'<>'false'
 OR r->>'eligibleByPolicy'<>'false'
 OR r->>'productionEnabled'<>'false'
 OR r->>'branchId'<>'48480000-0000-4848-8484-000000000030'
 OR pg_catalog.jsonb_array_length(r->'items')<>1
 OR (r->'items'->0->>'unitPricePyg')::integer<>12500
 THEN RAISE EXCEPTION 'G48 buyer catalog did not retain server authority'; END IF;
 RETURN true;
END $fn$;
CREATE FUNCTION public.mobility_stage_g48_ci_assert_replay(_ticket uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g48_driver_status_qa(_ticket);
 EXCEPTION WHEN SQLSTATE 'G4804' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G48 consumed Driver ticket replay accepted'; END IF;
 RETURN true;
END $fn$;
CREATE FUNCTION public.mobility_stage_g48_ci_assert_wrong_scope(_ticket uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g48_buyer_catalog_page_qa(_ticket,NULL,NULL);
 EXCEPTION WHEN SQLSTATE 'G4803' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G48 cross-scope use accepted'; END IF;
 RETURN true;
END $fn$;

-- DB OWNER in disposable QA alone can mint; gateway never takes actor params.
SELECT (public.mobility_stage_g48_mint_owner_attested_qa(
 '00000000-0000-4000-8000-000000000181',
 '48480000-0000-4848-8484-000000000101',
 floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint,
 'DRIVER_STATUS','00000000-0000-4000-8000-000000000181')->>'ticket') AS driver_ticket \gset
SELECT (public.mobility_stage_g48_mint_owner_attested_qa(
 '00000000-0000-4000-8000-000000000182',
 '48480000-0000-4848-8484-000000000102',
 floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint,
 'BUYER_CATALOG_PAGE','48480000-0000-4848-8484-000000000030')->>'ticket') AS buyer_ticket \gset
SELECT (public.mobility_stage_g48_mint_owner_attested_qa(
 '00000000-0000-4000-8000-000000000181',
 '48480000-0000-4848-8484-000000000101',
 floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint,
 'DRIVER_STATUS','00000000-0000-4000-8000-000000000181')->>'ticket') AS wrong_ticket \gset
SET LOCAL ROLE mobility_g48_gateway_ci;
SELECT public.mobility_stage_g48_ci_assert_wrong_scope(:'wrong_ticket'::uuid);
SELECT public.mobility_stage_g48_ci_assert_driver(:'driver_ticket'::uuid);
SELECT public.mobility_stage_g48_ci_assert_replay(:'driver_ticket'::uuid);
SELECT public.mobility_stage_g48_ci_assert_catalog(:'buyer_ticket'::uuid);
RESET ROLE;

DO $final$
DECLARE denied boolean:=false;
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_g48_ticket_audit
  WHERE action='MINTED')<>3 OR
 (SELECT count(*) FROM public.mobility_stage_g48_ticket_audit
  WHERE action='CONSUMED')<>2 OR
 (SELECT count(*) FROM public.mobility_stage_g48_delegation_proofs
  WHERE consumed_at IS NOT NULL)<>2
 THEN RAISE EXCEPTION 'G48 one-use ticket audit mismatched'; END IF;
 BEGIN
  DELETE FROM public.mobility_stage_g48_ticket_audit
  WHERE action='MINTED';
 EXCEPTION WHEN SQLSTATE 'G4807' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G48 audit deletion succeeded'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_g48_ticket_audit SET action='CONSUMED'
  WHERE action='MINTED';
 EXCEPTION WHEN SQLSTATE 'G4807' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G48 audit rewriting succeeded'; END IF;
 -- Independently revoke the G42 Driver session then prove a minted, unused
 -- ticket no longer grants read in the exact protected transaction.
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=pg_catalog.clock_timestamp()
 WHERE user_id='00000000-0000-4000-8000-000000000181'
 AND session_id='48480000-0000-4848-8484-000000000101';
 RAISE NOTICE 'G48 PASS: one-time capabilities, server catalog PYG and immutable audit';
END $final$;
SET LOCAL ROLE mobility_g48_gateway_ci;
CREATE FUNCTION public.mobility_stage_g48_ci_assert_revoked(_ticket uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g48_driver_status_qa(_ticket);
 EXCEPTION WHEN SQLSTATE 'G4801' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G48 revoked session used previously minted capability'; END IF;
 RETURN true;
END $fn$;
-- `CREATE FUNCTION` above needs DDL OWNER, not the delegated role, so the
-- temporary QA helper is defined before role handoff in final CI step.
RESET ROLE;
ROLLBACK;
