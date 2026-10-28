-- G94 integral PostgreSQL QA: G73 original Passenger booking -> G93
-- stored subsidized terms -> G3 passenger cancellation -> atomic reversal.
BEGIN;
SET LOCAL statement_timeout='50s';
INSERT INTO auth.users(id) VALUES
 ('94940000-0000-4949-8949-000000000001'),
 ('94940000-0000-4949-8949-000000000002'),
 ('94940000-0000-4949-8949-000000000003');
DELETE FROM public.user_roles
 WHERE user_id='94940000-0000-4949-8949-000000000002'::uuid;
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES ('94940000-0000-4949-8949-000000000002','owner','active',
        '94940000-0000-4949-8949-000000000002');
INSERT INTO public.mobility_stage_g93_ride_campaigns(
 id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
VALUES('94940000-0000-4949-8949-000000000020','AUTO_RIDE',
 'PY_AUTO_OWNER_60_QA_V2',
 '94940000-0000-4949-8949-000000000002',true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60);
DO $main$
DECLARE
 p uuid:='94940000-0000-4949-8949-000000000001';
 foreign_id uuid:='94940000-0000-4949-8949-000000000003';
 route uuid;quote uuid;trip uuid;event_id uuid;dto jsonb;replayed uuid;
 n integer;original_dr bigint;original_cr bigint;reversal_dr bigint;reversal_cr bigint;
 denied boolean:=false;
BEGIN
 route:=public.mobility_stage_g73_route(p,
  '94940000-0000-4949-8949-000000000010','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 quote:=public.mobility_stage_g73_quote(p,route,
  '94940000-0000-4949-8949-000000000011');
 IF public.mobility_stage_g94_auto_financial_state_qa(p,
  '94940000-0000-4949-8949-000000000012') IS NOT NULL
 THEN RAISE EXCEPTION 'G94 phantom finance before booking'; END IF;
 IF public.mobility_stage_g93_preview_auto_qa(p,quote)->>'customerPaysGs'<>'13680'
 THEN RAISE EXCEPTION 'G94 prerequisite terms did not persist'; END IF;
 trip:=public.mobility_stage_g73_book(p,quote,
  '94940000-0000-4949-8949-000000000012');
 dto:=public.mobility_stage_g94_auto_financial_state_qa(p,
  '94940000-0000-4949-8949-000000000012');
 IF dto->>'financialState'<>'RESERVED_QA' OR dto->>'tripState'<>'searching'
 OR dto->>'tripId'<>trip::text OR dto->>'customerPaysGs'<>'13680'
 OR dto->>'driverReceivesGs'<>'12920'
 OR dto->>'customerSubsidyGs'<>'1520' OR dto->>'platformRetainsGs'<>'760'
 OR dto->>'pspCollected'<>'false' OR dto->>'pspRefunded'<>'false'
 OR dto->>'originalEntriesBalanced'<>'true'
 OR dto->>'reversalEntriesBalanced'<>'false'
 THEN RAISE EXCEPTION 'G94 initial reserved ledger invalid %',dto; END IF;
 IF public.mobility_stage_g94_auto_financial_state_qa(foreign_id,
  '94940000-0000-4949-8949-000000000012') IS NOT NULL
 THEN RAISE EXCEPTION 'G94 foreign Passenger reads ledger'; END IF;
 -- Passenger cancellation is authorized by existing G3, never a fake Driver.
 event_id:=public.mobility_stage_auto_demo_transition(
  trip,p,'cancelled','94940000-0000-4949-8949-000000000013');
 IF event_id IS NULL THEN RAISE EXCEPTION 'G94 no cancellation event'; END IF;
 dto:=public.mobility_stage_g94_auto_financial_state_qa(p,
  '94940000-0000-4949-8949-000000000012');
 IF dto->>'financialState'<>'VOIDED_QA' OR dto->>'tripState'<>'cancelled'
 OR dto->>'tripRevision'<>'2' OR dto->>'tripId'<>trip::text
 OR dto->>'originalEntriesBalanced'<>'true'
 OR dto->>'reversalEntriesBalanced'<>'true'
 OR dto->>'pspCollected'<>'false' OR dto->>'pspRefunded'<>'false'
 THEN RAISE EXCEPTION 'G94 reversal did not commit with same trip %',dto; END IF;
 replayed:=public.mobility_stage_auto_demo_transition(
  trip,p,'cancelled','94940000-0000-4949-8949-000000000013');
 IF replayed<>event_id THEN RAISE EXCEPTION 'G94 lost ACK replay emitted new event'; END IF;
 IF public.mobility_stage_g73_book(p,quote,
  '94940000-0000-4949-8949-000000000012')<>trip
 THEN RAISE EXCEPTION 'G94 cancelled booking changed original tripId'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g94_auto_voids WHERE trip_id=trip)<>1
 OR (SELECT count(*) FROM public.mobility_stage_g94_auto_void_entries
     WHERE quote_id=quote)<>4
 THEN RAISE EXCEPTION 'G94 cancellation replay doubled or omitted reversal'; END IF;
 SELECT sum(CASE WHEN side='debit' THEN amount_gs ELSE 0 END),
 sum(CASE WHEN side='credit' THEN amount_gs ELSE 0 END)
 INTO original_dr,original_cr FROM public.mobility_stage_g93_auto_ledger_entries
 WHERE quote_id=quote;
 SELECT sum(CASE WHEN side='debit' THEN amount_gs ELSE 0 END),
 sum(CASE WHEN side='credit' THEN amount_gs ELSE 0 END)
 INTO reversal_dr,reversal_cr FROM public.mobility_stage_g94_auto_void_entries
 WHERE quote_id=quote;
 IF original_dr<>15200 OR original_cr<>15200
 OR reversal_dr<>15200 OR reversal_cr<>15200
 THEN RAISE EXCEPTION 'G94 asymmetric reversal'; END IF;
 -- Each of the four accounts nets to zero after the reversal.
 SELECT count(*) INTO n
 FROM public.mobility_stage_g93_auto_ledger_entries x
 JOIN public.mobility_stage_g94_auto_void_entries y
 ON y.quote_id=x.quote_id AND y.account=x.account
 WHERE x.quote_id=quote AND x.amount_gs=y.amount_gs AND x.side<>y.side;
 IF n<>4 THEN RAISE EXCEPTION 'G94 per-account amounts not fully reversed'; END IF;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_transition(
   trip,foreign_id,'cancelled','94940000-0000-4949-8949-000000000014');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G94 different actor cancelled again'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g94_auto_voids WHERE trip_id=trip)<>1
 THEN RAISE EXCEPTION 'G94 foreign retry wrote second reversal'; END IF;
 RAISE NOTICE 'G94 PASS: same G73 trip, 4 matching reversal entries, lost ACK idempotent, no PSP';
END $main$;

-- A newly approved campaign is inactive by default when flagged off.
-- A separate Passenger cancellation with no G93 ledger must still work.
UPDATE public.mobility_stage_g93_ride_campaigns SET active=false
 WHERE id='94940000-0000-4949-8949-000000000020'::uuid;
DO $legacy$
DECLARE p uuid:='94940000-0000-4949-8949-000000000003';
 route uuid;quote uuid;trip uuid;
BEGIN
 route:=public.mobility_stage_g73_route(p,
  '94940000-0000-4949-8949-000000000030','economico',
  'CENTRO_FIXTURE','SHOPPING','ASUNCION_FIXTURE',5000,600,0);
 quote:=public.mobility_stage_g73_quote(p,route,
  '94940000-0000-4949-8949-000000000031');
 trip:=public.mobility_stage_g73_book(p,quote,
  '94940000-0000-4949-8949-000000000032');
 PERFORM public.mobility_stage_auto_demo_transition(
  trip,p,'cancelled','94940000-0000-4949-8949-000000000033');
 IF (SELECT count(*) FROM public.mobility_stage_g94_auto_voids WHERE trip_id=trip)<>0
 OR public.mobility_stage_g94_auto_financial_state_qa(p,
  '94940000-0000-4949-8949-000000000032') IS NOT NULL
 OR (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>'cancelled'
 THEN RAISE EXCEPTION 'G94 broke non-campaign G73 cancellation'; END IF;
 RAISE NOTICE 'G94 PASS: no-campaign AUTO cancellation unchanged, no phantom refund';
END $legacy$;
DO $privileges$
BEGIN
 IF has_table_privilege('service_role','public.mobility_stage_g94_auto_voids','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_g94_auto_void_entries','SELECT')
 OR has_function_privilege('anon','public.mobility_stage_g94_auto_financial_state_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.mobility_stage_g94_auto_financial_state_qa(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
   'public.mobility_stage_g94_auto_financial_state_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G94 leaked finance reversal authority'; END IF;
END $privileges$;
ROLLBACK; -- No QA passengers, campaigns, reversal or money survive.
