-- G93 end-to-end SQL disposable QA: G73 quote -> preview -> G73 book
-- -> trigger -> four balanced ledger rows; idempotent recovery, Owner/RLS fences.
BEGIN;
SET LOCAL statement_timeout='50s';
INSERT INTO auth.users(id) VALUES
 ('93930000-0000-4939-8939-000000000001'),
 ('93930000-0000-4939-8939-000000000002');
DELETE FROM public.user_roles
 WHERE user_id='93930000-0000-4939-8939-000000000002'::uuid;
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES ('93930000-0000-4939-8939-000000000002','owner','active',
        '93930000-0000-4939-8939-000000000002');
DO $test$
DECLARE
 p uuid:='93930000-0000-4939-8939-000000000001';
 o uuid:='93930000-0000-4939-8939-000000000002';
 rt uuid;qt uuid;trip uuid; receipt jsonb; settlement jsonb;
 denied boolean:=false; dr bigint;cr bigint;
BEGIN
 rt:=public.mobility_stage_g73_route(p,
  '93930000-0000-4939-8939-000000000010'::uuid,'economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 qt:=public.mobility_stage_g73_quote(p,rt,
  '93930000-0000-4939-8939-000000000011'::uuid);
 BEGIN
  PERFORM public.mobility_stage_g93_preview_auto_qa(p,qt);
 EXCEPTION WHEN SQLSTATE 'P9301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G93 must reject subsidy when campaign off'; END IF;
 INSERT INTO public.mobility_stage_g93_ride_campaigns(
  id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
 VALUES('93930000-0000-4939-8939-000000000020','AUTO_RIDE',
  'PY_AUTO_OWNER_60_QA_V1',o,true,
  pg_catalog.clock_timestamp()-interval '1 hour',
  pg_catalog.clock_timestamp()-interval '1 hour'+interval '60 days',60);
 receipt:=public.mobility_stage_g93_preview_auto_qa(p,qt);
 IF receipt->>'mode'<>'STAGING_DEMO_ONLY' OR receipt->>'ownerId'<>p::text
 OR receipt->>'serviceKind'<>'AUTO_RIDE' OR receipt->>'originalFareGs'<>'15200'
 OR receipt->>'nominalCommissionGs'<>'2280'
 OR receipt->>'customerSubsidyGs'<>'1520'
 OR receipt->>'customerPaysGs'<>'13680'
 OR receipt->>'driverReceivesGs'<>'12920'
 OR receipt->>'platformRetainsGs'<>'760'
 OR receipt->>'serverPersisted'<>'true'
 THEN RAISE EXCEPTION 'G93 displayed commission/subsidy mismatch: %',receipt; END IF;
 IF receipt<>public.mobility_stage_g93_preview_auto_qa(p,qt)
 THEN RAISE EXCEPTION 'G93 preview replay drift'; END IF;
 IF public.mobility_stage_g93_terms_receipt_qa(o,qt) IS NOT NULL
 THEN RAISE EXCEPTION 'G93 non-owner can read passenger receipt'; END IF;
 trip:=public.mobility_stage_g73_book(p,qt,
  '93930000-0000-4939-8939-000000000012');
 IF trip<>public.mobility_stage_g73_book(p,qt,
  '93930000-0000-4939-8939-000000000012')
 THEN RAISE EXCEPTION 'G93 lost ACK duplicates booking'; END IF;
 settlement:=public.mobility_stage_g93_settlement_receipt_qa(p,
  '93930000-0000-4939-8939-000000000012');
 IF settlement->>'tripId'<>trip::text
 OR settlement->>'customerPaysGs'<>'13680'
 OR settlement->>'customerSubsidyGs'<>'1520'
 OR settlement->>'driverReceivesGs'<>'12920'
 OR settlement->>'nominalCommissionGs'<>'2280'
 OR settlement->>'platformRetainsGs'<>'760'
 OR settlement->>'entriesPersisted'<>'true'
 THEN RAISE EXCEPTION 'G93 broken atomic ledger %',settlement; END IF;
 IF public.mobility_stage_g93_settlement_receipt_qa(o,
  '93930000-0000-4939-8939-000000000012') IS NOT NULL
 THEN RAISE EXCEPTION 'G93 forged owner scope'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g93_auto_ledger
     WHERE trip_id=trip)<>1
 OR (SELECT count(*) FROM public.mobility_stage_g93_auto_ledger_entries
     WHERE quote_id=qt)<>4
 THEN RAISE EXCEPTION 'G93 duplicate settlement or missing entries'; END IF;
 SELECT
  sum(CASE WHEN side='debit' THEN amount_gs ELSE 0 END),
  sum(CASE WHEN side='credit' THEN amount_gs ELSE 0 END)
 INTO dr,cr FROM public.mobility_stage_g93_auto_ledger_entries WHERE quote_id=qt;
 IF dr<>15200 OR cr<>15200 THEN RAISE EXCEPTION 'G93 double-entry mismatch'; END IF;
 RAISE NOTICE 'G93 PASS: one G73 booking, same tripId, 10 pct subsidy and balanced atomic ledger';
END $test$;

-- Another Passenger creates a valid G73 quote but cannot book under an
-- active Owner campaign without accepting the persisted discounted preview.
DO $missing$
DECLARE p uuid:='93930000-0000-4939-8939-000000000001';
 rt uuid;qt uuid;denied boolean:=false;
BEGIN
 rt:=public.mobility_stage_g73_route(p,
  '93930000-0000-4939-8939-000000000030','economico',
  'CENTRO_FIXTURE','SHOPPING','ASUNCION_FIXTURE',5000,600,0);
 qt:=public.mobility_stage_g73_quote(p,rt,
  '93930000-0000-4939-8939-000000000031');
 BEGIN PERFORM public.mobility_stage_g73_book(p,qt,
  '93930000-0000-4939-8939-000000000032');
 EXCEPTION WHEN SQLSTATE 'P9301' THEN denied:=true; END;
 IF NOT denied OR (SELECT trip_id FROM public.mobility_stage_g72_auto_prequotes
  WHERE id=qt) IS NOT NULL THEN
  RAISE EXCEPTION 'G93 undisclosed campaign subsidy bypassed'; END IF;
 RAISE NOTICE 'G93 PASS: direct booking without discount preview rolls back entirely';
END $missing$;

DO $rights$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_g93_preview_auto_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g93_settlement_receipt_qa(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g93_preview_auto_qa(uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g93_auto_ledger','INSERT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_g93_auto_ledger_entries','SELECT')
 THEN RAISE EXCEPTION 'G93 private financial authority leaked'; END IF;
END $rights$;

-- Disabled Owner status immediately invalidates future previews.
UPDATE public.mobility_stage_backoffice_roles
 SET status='suspended',revision=revision+1
 WHERE user_id='93930000-0000-4939-8939-000000000002'::uuid;
DO $revoked$
DECLARE p uuid:='93930000-0000-4939-8939-000000000001';
 qt uuid;denied boolean:=false;
BEGIN
 SELECT id INTO qt FROM public.mobility_stage_g72_auto_prequotes
 WHERE request_key='93930000-0000-4939-8939-000000000031'::uuid;
 BEGIN PERFORM public.mobility_stage_g93_preview_auto_qa(p,qt);
 EXCEPTION WHEN SQLSTATE 'P9301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G93 revoked Owner still approves discount'; END IF;
END $revoked$;
ROLLBACK; -- No synthetic owner, rider, campaign, settlement or money survives.
