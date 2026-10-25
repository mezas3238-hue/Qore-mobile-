-- G95 proof against disposable PG16: G73->G93->booking->G3 cancel
-- ->G94 opposing ledger->G95 source-backed receipt and replay protection.
BEGIN;
SET LOCAL statement_timeout='60s';
INSERT INTO auth.users(id) VALUES
 ('95950000-0000-4959-8959-000000000001'),
 ('95950000-0000-4959-8959-000000000002'),
 ('95950000-0000-4959-8959-000000000003');
DELETE FROM public.user_roles
 WHERE user_id='95950000-0000-4959-8959-000000000002'::uuid;
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES('95950000-0000-4959-8959-000000000002','owner','active',
 '95950000-0000-4959-8959-000000000002');
INSERT INTO public.mobility_stage_g93_ride_campaigns(
 id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
VALUES ('95950000-0000-4959-8959-000000000020','AUTO_RIDE',
 'PY_AUTO_OWNER_60_QA_G95','95950000-0000-4959-8959-000000000002',true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60);
DO $test$
DECLARE
 p uuid:='95950000-0000-4959-8959-000000000001';
 stranger uuid:='95950000-0000-4959-8959-000000000003';
 b uuid:='95950000-0000-4959-8959-000000000012';
 k uuid:='95950000-0000-4959-8959-000000000013';
 route uuid;quote uuid;trip uuid;x jsonb;y jsonb;denied boolean:=false;
BEGIN
 route:=public.mobility_stage_g73_route(p,
  '95950000-0000-4959-8959-000000000010','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 quote:=public.mobility_stage_g73_quote(p,route,
  '95950000-0000-4959-8959-000000000011');
 PERFORM public.mobility_stage_g93_preview_auto_qa(p,quote);
 trip:=public.mobility_stage_g73_book(p,quote,b);
 IF public.mobility_stage_g95_cancel_receipt_qa(p,b) IS NOT NULL
 OR public.mobility_stage_g95_cancel_receipt_qa(stranger,b) IS NOT NULL
 THEN RAISE EXCEPTION 'G95 fabricated cancellation before transaction'; END IF;
 BEGIN PERFORM public.mobility_stage_g95_cancel_booked_auto_qa(stranger,b,k);
 EXCEPTION WHEN SQLSTATE 'P9501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G95 foreign passenger forged cancellation'; END IF;
 x:=public.mobility_stage_g95_cancel_booked_auto_qa(p,b,k);
 IF x->>'mode'<>'STAGING_DEMO_ONLY'
 OR x->>'commercialEnabled'<>'false' OR x->>'ownerId'<>p::text
 OR x->>'bookingKey'<>b::text OR x->>'cancellationKey'<>k::text
 OR x->>'tripId'<>trip::text OR x->>'quoteId'<>quote::text
 OR x->>'tripState'<>'cancelled' OR x->>'tripRevision'<>'2'
 OR x->>'financialState'<>'VOIDED_QA'
 OR x->>'reversalEntriesBalanced'<>'true'
 OR x->>'pspCollected'<>'false' OR x->>'pspRefunded'<>'false'
 OR x->>'serverPersisted'<>'true'
 OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(x))<>15
 THEN RAISE EXCEPTION 'G95 wrong source-backed F1 receipt %',x; END IF;
 y:=public.mobility_stage_g95_cancel_booked_auto_qa(p,b,k);
 IF y<>x OR public.mobility_stage_g95_cancel_receipt_qa(p,b)<>x
 THEN RAISE EXCEPTION 'G95 same cancellation replay/GET changed receipt'; END IF;
 IF public.mobility_stage_g95_cancel_receipt_qa(stranger,b) IS NOT NULL
 THEN RAISE EXCEPTION 'G95 foreign receipt leaked'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_events
  WHERE trip_id=trip AND next_status='cancelled')<>1
 OR (SELECT count(*) FROM public.mobility_stage_g94_auto_voids
  WHERE trip_id=trip)<>1
 OR (SELECT count(*) FROM public.mobility_stage_g94_auto_void_entries
  WHERE quote_id=quote)<>4
 OR (SELECT status FROM public.mobility_stage_auto_demo_trips
  WHERE id=trip)<>'cancelled'
 THEN RAISE EXCEPTION 'G95 duplicated transition or reversal'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g95_cancel_booked_auto_qa(p,b,
  '95950000-0000-4959-8959-000000000014');
 EXCEPTION WHEN SQLSTATE 'P9501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G95 second decision key on cancelled booking'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g95_cancel_booked_auto_qa(p,
  '95950000-0000-4959-8959-000000000022',k);
 EXCEPTION WHEN SQLSTATE 'P9501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G95 same decision key on foreign booking'; END IF;
 RAISE NOTICE 'G95 PASS: real G73->G93->G3->G94 one cancellation, SQL receipt, replay and actor fence';
END $test$;

UPDATE public.mobility_stage_g93_ride_campaigns SET active=false
 WHERE id='95950000-0000-4959-8959-000000000020'::uuid;
DO $ordinary$
DECLARE p uuid:='95950000-0000-4959-8959-000000000003';
 b uuid:='95950000-0000-4959-8959-000000000032';
 rt uuid;qt uuid;trip uuid;x jsonb;
BEGIN
 rt:=public.mobility_stage_g73_route(p,
  '95950000-0000-4959-8959-000000000030','economico',
  'CENTRO_FIXTURE','SHOPPING','ASUNCION_FIXTURE',5000,600,0);
 qt:=public.mobility_stage_g73_quote(p,rt,
  '95950000-0000-4959-8959-000000000031');
 trip:=public.mobility_stage_g73_book(p,qt,b);
 x:=public.mobility_stage_g95_cancel_booked_auto_qa(p,b,
  '95950000-0000-4959-8959-000000000033');
 IF x->>'financialState'<>'NO_CAMPAIGN_QA'
 OR x->>'reversalEntriesBalanced'<>'false'
 OR x->>'tripId'<>trip::text
 OR public.mobility_stage_g95_cancel_receipt_qa(p,b)<>x
 THEN RAISE EXCEPTION 'G95 no-campaign cancellation invents subsidy reversal'; END IF;
 RAISE NOTICE 'G95 PASS: non-promotional AUTO cancellation same booking, no phantom PSP refund';
END $ordinary$;
DO $privileges$
BEGIN
 IF has_function_privilege('authenticated',
 'public.mobility_stage_g95_cancel_booked_auto_qa(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
 'public.mobility_stage_g95_cancel_receipt_qa(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
 'public.mobility_stage_g95_cancel_booked_auto_qa(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role',
 'public.mobility_stage_g94_auto_voids','INSERT')
 THEN RAISE EXCEPTION 'G95 private cancellation or finance leaked'; END IF;
END $privileges$;
ROLLBACK;
