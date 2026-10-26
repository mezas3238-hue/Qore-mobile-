-- G116: actual AUTO/MOTO percentages change under Owner authority.
-- Old immutable quote + eventual booking must NOT be repriced. Roll back QA.
BEGIN;
SET LOCAL statement_timeout='50s';
INSERT INTO auth.users(id) VALUES
 ('11600000-0000-4116-8116-000000000001'),
 ('11600000-0000-4116-8116-000000000002'),
 ('11600000-0000-4116-8116-000000000011'),
 ('11600000-0000-4116-8116-000000000012'),
 ('11600000-0000-4116-8116-000000000021'),
 ('11600000-0000-4116-8116-000000000022');
DELETE FROM public.user_roles
 WHERE user_id='11600000-0000-4116-8116-000000000001';
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('11600000-0000-4116-8116-000000000001','owner','active',
        '11600000-0000-4116-8116-000000000001');
INSERT INTO public.mobility_stage_fare_rules(rule_key,mode,zone_tag,
 base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,commission_bps,
 valid_from,valid_until,active,approved_by,approved_at)
VALUES('G116_MOTO_RULE_V1','MOTO','MOTO_TEST_ZONE',
 4000,1000,200,4000,1200,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()+interval '60 days',
 true,'11600000-0000-4116-8116-000000000001',
 pg_catalog.transaction_timestamp()-interval '2 hours');
INSERT INTO public.mobility_stage_g93_ride_campaigns
 (id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
VALUES
 ('11600000-0000-4116-8116-000000001001','AUTO_RIDE','G116_AUTO_60_QA',
 '11600000-0000-4116-8116-000000000001',true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60),
 ('11600000-0000-4116-8116-000000001002','MOTO_RIDE','G116_MOTO_60_QA',
 '11600000-0000-4116-8116-000000000001',true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60);
DO $test$
DECLARE
 owner_id uuid:='11600000-0000-4116-8116-000000000001';
 outsider uuid:='11600000-0000-4116-8116-000000000002';
 a1 uuid:='11600000-0000-4116-8116-000000000011';
 a2 uuid:='11600000-0000-4116-8116-000000000012';
 m1 uuid:='11600000-0000-4116-8116-000000000021';
 m2 uuid:='11600000-0000-4116-8116-000000000022';
 old_auto uuid;new_auto uuid;rt uuid;
 before_auto jsonb;before_moto jsonb;after_auto jsonb;after_moto jsonb;
 booked jsonb;settled jsonb;owner_result jsonb;
 denied boolean:=false;
BEGIN
 IF (public.mobility_stage_g116_read_commission_qa('AUTO_RIDE')->>'commissionBps')<>'1500'
 OR (public.mobility_stage_g116_read_commission_qa('MOTO_RIDE')->>'commissionBps')<>'1200'
 THEN RAISE EXCEPTION 'G116 initial owner commission values incorrect'; END IF;
 -- Quotes are recorded before any Owner commission change.
 rt:=public.mobility_stage_g73_route(a1,
  '11600000-0000-4116-8116-000000002001','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 old_auto:=public.mobility_stage_g73_quote(a1,rt,
  '11600000-0000-4116-8116-000000002002');
 before_auto:=public.mobility_stage_g93_preview_auto_qa(a1,old_auto);
 before_moto:=public.mobility_stage_g100_moto_quote_qa(m1,
  '11600000-0000-4116-8116-000000002003',
  'CENTRO_FIXTURE','AEROPUERTO','MOTO_TEST_ZONE',5000,600);
 IF before_auto->>'commissionBps'<>'1500'
 OR before_auto->>'subsidyBps'<>'1000'
 OR before_moto->>'commissionBps'<>'1200'
 OR before_moto->>'subsidyBps'<>'1000'
 THEN RAISE EXCEPTION 'G116 old rate snapshot incorrect'; END IF;
 -- Server-verified Owner can update each vertical independently.
 owner_result:=public.mobility_stage_g116_set_commission_qa(owner_id,'AUTO_RIDE',1800,
  '11600000-0000-4116-8116-000000003001');
 IF owner_result->>'commissionBps'<>'1800' OR owner_result->>'version'<>'2'
 OR owner_result->>'subsidyBps'<>'1000'
 THEN RAISE EXCEPTION 'G116 AUTO owner commission update failed'; END IF;
 IF owner_result<>public.mobility_stage_g116_set_commission_qa(owner_id,'AUTO_RIDE',1800,
  '11600000-0000-4116-8116-000000003001')
 THEN RAISE EXCEPTION 'G116 same-key replay not idempotent'; END IF;
 owner_result:=public.mobility_stage_g116_set_commission_qa(owner_id,'MOTO_RIDE',1400,
  '11600000-0000-4116-8116-000000003002');
 IF owner_result->>'commissionBps'<>'1400' OR owner_result->>'version'<>'2'
 THEN RAISE EXCEPTION 'G116 MOTO owner commission update failed'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g116_commission_audit)<>2
 OR (SELECT count(*) FROM public.mobility_stage_g116_commission_policy
     WHERE version=2 AND changed_by=owner_id)<>2
 THEN RAISE EXCEPTION 'G116 failed auditable per-service revision'; END IF;
 -- Invalid range, foreign Owner and conflicting request key are denied.
 BEGIN
  PERFORM public.mobility_stage_g116_set_commission_qa(outsider,'AUTO_RIDE',1900,
   '11600000-0000-4116-8116-000000003003');
 EXCEPTION WHEN SQLSTATE 'P1161' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G116 accepts nonowner rate edit'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g116_set_commission_qa(owner_id,'AUTO_RIDE',900,
   '11600000-0000-4116-8116-000000003004');
 EXCEPTION WHEN SQLSTATE 'P1161' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G116 violates fixed 10pct customer subsidy solvency'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g116_set_commission_qa(owner_id,'MOTO_RIDE',3100,
   '11600000-0000-4116-8116-000000003005');
 EXCEPTION WHEN SQLSTATE 'P1161' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G116 accepts uncapped rate'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g116_set_commission_qa(owner_id,'AUTO_RIDE',1900,
   '11600000-0000-4116-8116-000000003001');
 EXCEPTION WHEN SQLSTATE 'P1161' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G116 conflicting rate replay accepted'; END IF;
 -- Old quote is still 15/12: no retroactive commission mutation.
 IF public.mobility_stage_g93_preview_auto_qa(a1,old_auto)<>before_auto
 OR public.mobility_stage_g100_moto_quote_qa(m1,
  '11600000-0000-4116-8116-000000002003',
  'CENTRO_FIXTURE','AEROPUERTO','MOTO_TEST_ZONE',5000,600)<>before_moto
 THEN RAISE EXCEPTION 'G116 retroactively changed a previously issued quote'; END IF;
 -- Fresh quotes MUST include new persisted server commission.
 rt:=public.mobility_stage_g73_route(a2,
  '11600000-0000-4116-8116-000000002011','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 new_auto:=public.mobility_stage_g73_quote(a2,rt,
  '11600000-0000-4116-8116-000000002012');
 after_auto:=public.mobility_stage_g93_preview_auto_qa(a2,new_auto);
 after_moto:=public.mobility_stage_g100_moto_quote_qa(m2,
  '11600000-0000-4116-8116-000000002013',
  'CENTRO_FIXTURE','AEROPUERTO','MOTO_TEST_ZONE',5000,600);
 IF after_auto->>'commissionBps'<>'1800' OR after_auto->>'subsidyBps'<>'1000'
 OR after_auto->>'nominalCommissionGs'<>'2736'
 OR after_auto->>'platformRetainsGs'<>'1216'
 OR after_auto->>'customerPaysGs'<>'13680'
 OR after_moto->>'commissionBps'<>'1400'
 OR after_moto->>'customerPaysGs'<>'9900'
 OR after_moto->>'driverReceivesGs'<>'9460'
 OR after_moto->>'platformRetainsGs'<>'440'
 THEN RAISE EXCEPTION 'G116 new rates violate accounting % %',after_auto,after_moto; END IF;
 -- Old and new AUTO bookings settle at their original disclosed rates.
 PERFORM public.mobility_stage_g73_book(a1,old_auto,
  '11600000-0000-4116-8116-000000004001');
 PERFORM public.mobility_stage_g73_book(a2,new_auto,
  '11600000-0000-4116-8116-000000004002');
 settled:=public.mobility_stage_g93_settlement_receipt_qa(a1,
  '11600000-0000-4116-8116-000000004001');
 IF settled->>'nominalCommissionGs'<>'2280'
 OR settled->>'platformRetainsGs'<>'760' OR settled->>'entriesPersisted'<>'true'
 THEN RAISE EXCEPTION 'G116 old AUTO booking repriced'; END IF;
 settled:=public.mobility_stage_g93_settlement_receipt_qa(a2,
  '11600000-0000-4116-8116-000000004002');
 IF settled->>'nominalCommissionGs'<>'2736'
 OR settled->>'platformRetainsGs'<>'1216' OR settled->>'entriesPersisted'<>'true'
 THEN RAISE EXCEPTION 'G116 new AUTO booking not financially balanced'; END IF;
 booked:=public.mobility_stage_g100_moto_book_qa(m1,(before_moto->>'quoteId')::uuid,
  '11600000-0000-4116-8116-000000004003');
 IF booked->>'commissionBps'<>'1200' OR booked->>'platformRetainsGs'<>'220'
 THEN RAISE EXCEPTION 'G116 old MOTO booking repriced'; END IF;
 booked:=public.mobility_stage_g100_moto_book_qa(m2,(after_moto->>'quoteId')::uuid,
  '11600000-0000-4116-8116-000000004004');
 IF booked->>'commissionBps'<>'1400' OR booked->>'platformRetainsGs'<>'440'
 OR booked->>'financialState'<>'RESERVED_QA'
 THEN RAISE EXCEPTION 'G116 new MOTO booking not financially balanced'; END IF;
 RAISE NOTICE 'G116 PASS: Owner configurable AUTO 15->18 and MOTO 12->14, 10pct subsidy fixed; immutable quotes, balanced old/new PG ledger, audit, replay and role guards';
END $test$;
DO $priv$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_g116_set_commission_qa(uuid,text,integer,uuid)','EXECUTE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g116_commission_policy','UPDATE')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_g116_commission_audit','SELECT')
 THEN RAISE EXCEPTION 'G116 commission privilege leak'; END IF;
END $priv$;
ROLLBACK;
