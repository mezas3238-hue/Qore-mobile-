-- G100: only MOTO passenger quote/book/cancel. All fixtures rolled back.
BEGIN;
SET LOCAL statement_timeout='75s';
INSERT INTO auth.users(id) VALUES
 ('10000000-0000-4100-8100-000000000001'),
 ('10000000-0000-4100-8100-000000000002'),
 ('10000000-0000-4100-8100-000000000003');
DELETE FROM public.user_roles WHERE user_id='10000000-0000-4100-8100-000000000002';
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('10000000-0000-4100-8100-000000000002','owner','active',
 '10000000-0000-4100-8100-000000000002');
INSERT INTO public.mobility_stage_fare_rules(
 rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,
 commission_bps,valid_from,valid_until,active,approved_by,approved_at)
VALUES('G100_MOTO_QA_ONLY','MOTO','MOTO_TEST_ZONE',
 4000,1000,200,4000,1200,
 pg_catalog.clock_timestamp()-interval '1 hour',
 pg_catalog.clock_timestamp()+interval '60 days',true,
 '10000000-0000-4100-8100-000000000002',
 pg_catalog.clock_timestamp()-interval '2 hours');
INSERT INTO public.mobility_stage_g93_ride_campaigns(
 id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
VALUES('10000000-0000-4100-8100-000000000020','MOTO_RIDE',
 'G100_MOTO_60D_QA','10000000-0000-4100-8100-000000000002',true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60);
-- Inspect source-backed table invariants as disposable CI migration owner;
-- direct table privileges remain revoked for the service_role.
DO $demo$
DECLARE
 p uuid:='10000000-0000-4100-8100-000000000001';
 foreign_user uuid:='10000000-0000-4100-8100-000000000003';
 b uuid:='10000000-0000-4100-8100-000000000012';
 c uuid:='10000000-0000-4100-8100-000000000013';
 quote jsonb;receipt jsonb;final jsonb;not_allowed boolean;
 id uuid;
BEGIN
 quote:=public.mobility_stage_g100_moto_quote_qa(p,
 '10000000-0000-4100-8100-000000000011',
 'CENTRO_FIXTURE','AEROPUERTO','MOTO_TEST_ZONE',5000,600);
 IF quote->>'serviceKind'<>'MOTO_RIDE' OR quote->>'service'<>'moto_pasajero'
 OR quote->>'amountGs'<>'11000' OR quote->>'commissionBps'<>'1200'
 OR quote->>'subsidyBps'<>'1000' OR quote->>'customerPaysGs'<>'9900'
 OR quote->>'driverReceivesGs'<>'9680' OR quote->>'platformRetainsGs'<>'220'
 OR quote->>'customerSubsidyGs'<>'1100'
 OR quote->>'commercialEnabled'<>'false' OR quote->>'driverAssigned'<>'false'
 OR quote->>'pspCollected'<>'false'
 THEN RAISE EXCEPTION 'G100 MOTO passenger math/identity wrong %',quote; END IF;
 id:=(quote->>'quoteId')::uuid;
 IF public.mobility_stage_g100_moto_quote_receipt_qa(foreign_user,id) IS NOT NULL
 THEN RAISE EXCEPTION 'G100 foreign quote leaked'; END IF;
 receipt:=public.mobility_stage_g100_moto_book_qa(p,id,b);
 IF receipt->>'tripState'<>'searching'
 OR receipt->>'financialState'<>'RESERVED_QA'
 OR receipt->>'tripRevision'<>'1' OR receipt->>'bookingKey'<>b::text
 OR receipt->>'serviceKind'<>'MOTO_RIDE'
 OR receipt->>'driverAssigned'<>'false'
 THEN RAISE EXCEPTION 'G100 Passenger booking not persisted %',receipt; END IF;
 IF public.mobility_stage_g100_moto_book_qa(p,id,b)<>receipt
 OR public.mobility_stage_g100_moto_booking_receipt_qa(p,b)<>receipt
 OR public.mobility_stage_g100_moto_booking_receipt_qa(foreign_user,b) IS NOT NULL
 THEN RAISE EXCEPTION 'G100 booking replay or privacy broken'; END IF;
 not_allowed:=false;
 BEGIN PERFORM public.mobility_stage_g100_moto_book_qa(foreign_user,id,
 '10000000-0000-4100-8100-000000000021');
 EXCEPTION WHEN SQLSTATE 'P1001' THEN not_allowed:=true; END;
 IF NOT not_allowed THEN RAISE EXCEPTION 'G100 another Passenger booked owned quote'; END IF;
 final:=public.mobility_stage_g100_moto_cancel_qa(p,b,c);
 IF final->>'tripState'<>'cancelled'
 OR final->>'financialState'<>'VOIDED_QA'
 OR final->>'reversalEntriesBalanced'<>'true'
 OR final->>'tripRevision'<>'2' OR final->>'cancellationKey'<>c::text
 OR final->>'pspRefunded'<>'false'
 OR public.mobility_stage_g100_moto_cancel_qa(p,b,c)<>final
 OR public.mobility_stage_g100_moto_booking_receipt_qa(p,b)<>final
 OR (SELECT count(*) FROM public.mobility_stage_g100_moto_entries
 WHERE quote_id=id AND phase='reserve')<>4
 OR (SELECT count(*) FROM public.mobility_stage_g100_moto_entries
 WHERE quote_id=id AND phase='reverse')<>4
 OR (SELECT count(*) FROM public.mobility_stage_g100_moto_trips
 WHERE booking_key=b AND status='cancelled' AND service='moto_pasajero')<>1
 THEN RAISE EXCEPTION 'G100 MOTO cancellation not reconciled %',final; END IF;
 not_allowed:=false;
 BEGIN PERFORM public.mobility_stage_g100_moto_cancel_qa(p,b,
 '10000000-0000-4100-8100-000000000099');
 EXCEPTION WHEN SQLSTATE 'P1001' THEN not_allowed:=true; END;
 IF NOT not_allowed THEN RAISE EXCEPTION 'G100 new decision key duplicated void'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips
 WHERE passenger_id=p)
 OR EXISTS(SELECT 1 FROM public.mobility_stage_deliveries
 WHERE sender_id=p)
 THEN RAISE EXCEPTION 'G100 MOTO passenger contaminated AUTO or DELIVERY'; END IF;
 RAISE NOTICE 'G100 PASS: real MOTO passenger quote 12/10/2, immutable book, 4-entry reserve and 4-entry reversal, replay, owner privacy and separate trip';
END $demo$;
SET LOCAL ROLE service_role;
DO $server_only$
DECLARE result jsonb;
BEGIN
 result:=public.mobility_stage_g100_moto_booking_receipt_qa(
  '10000000-0000-4100-8100-000000000001'::uuid,
  '10000000-0000-4100-8100-000000000012'::uuid);
 IF result->>'tripState'<>'cancelled'
 OR result->>'financialState'<>'VOIDED_QA'
 THEN RAISE EXCEPTION 'G100 private service RPC failed'; END IF;
 RAISE NOTICE 'G100 PASS: private service_role can read authorized MOTO receipt';
END $server_only$;
RESET ROLE;
DO $private$
BEGIN
 IF has_table_privilege('authenticated',
  'public.mobility_stage_g100_moto_quotes','SELECT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g100_moto_trips','INSERT')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g100_moto_cancel_qa(uuid,uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g100_moto_cancel_qa(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G100 SQL client privileges leaked'; END IF;
END $private$;
ROLLBACK;
