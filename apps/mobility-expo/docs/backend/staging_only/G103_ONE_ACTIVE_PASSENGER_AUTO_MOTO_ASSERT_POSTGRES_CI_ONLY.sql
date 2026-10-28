-- G103 deterministic one-identity ride lifecycle through original G73 and G100
-- SQL (no duplicate trip/ledger, no irreversible restrictions after cancel).
BEGIN;
SET LOCAL statement_timeout='70s';
INSERT INTO auth.users(id) VALUES
 ('10300000-0000-4103-8103-000000000001'),
 ('10300000-0000-4103-8103-000000000002');
DELETE FROM public.user_roles
 WHERE user_id='10300000-0000-4103-8103-000000000002';
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('10300000-0000-4103-8103-000000000002','owner','active',
 '10300000-0000-4103-8103-000000000002');
INSERT INTO public.mobility_stage_fare_rules(
 rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,
 commission_bps,valid_from,valid_until,active,approved_by,approved_at)
 VALUES('G103_MOTO_QA','MOTO','MOTO_GUARD_ZONE',4000,1000,200,4000,1200,
 clock_timestamp()-interval '1 hour',
 clock_timestamp()+interval '60 days',true,
 '10300000-0000-4103-8103-000000000002',
 clock_timestamp()-interval '2 hours');
-- G102 leaves its own synthetic MOTO campaign active in this disposable
-- chain. Temporarily retire that CI fixture while testing a separate Owner
-- approval; ROLLBACK restores the earlier campaign after this assertion.
UPDATE public.mobility_stage_g93_ride_campaigns SET active=false
 WHERE service_kind='MOTO_RIDE' AND active;
-- G98 leaves an independently approved synthetic AUTO campaign; isolate
-- this G103 cross-service test without relaxing G93 booking disclosure.
UPDATE public.mobility_stage_g93_ride_campaigns SET active=false
 WHERE service_kind='AUTO_RIDE' AND active;
INSERT INTO public.mobility_stage_g93_ride_campaigns
 (id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
 VALUES('10300000-0000-4103-8103-000000000020','MOTO_RIDE',
 'G103_MOTO_60D_QA','10300000-0000-4103-8103-000000000002',true,
 transaction_timestamp()-interval '1 hour',
 transaction_timestamp()-interval '1 hour'+interval '60 days',60);
DO $f1$
DECLARE
 passenger uuid:='10300000-0000-4103-8103-000000000001';
 route uuid;quote uuid;ride uuid;moto_quote jsonb;moto_booking jsonb;
 denied boolean:=false;
BEGIN
 route:=public.mobility_stage_g73_route(passenger,
  '10300000-0000-4103-8103-000000000010','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 quote:=public.mobility_stage_g73_quote(passenger,route,
  '10300000-0000-4103-8103-000000000011');
 ride:=public.mobility_stage_g73_book(passenger,quote,
  '10300000-0000-4103-8103-000000000012');
 moto_quote:=public.mobility_stage_g100_moto_quote_qa(passenger,
  '10300000-0000-4103-8103-000000000021',
  'PANTEON','SHOPPING','MOTO_GUARD_ZONE',5000,600);
 IF moto_quote->>'serviceKind'<>'MOTO_RIDE'
 OR moto_quote->>'commissionBps'<>'1200'
 OR moto_quote->>'subsidyBps'<>'1000'
 THEN RAISE EXCEPTION 'G103 MOTO quote terms unavailable'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g100_moto_book_qa(passenger,
   (moto_quote->>'quoteId')::uuid,'10300000-0000-4103-8103-000000000022');
 EXCEPTION WHEN SQLSTATE 'P1001' OR SQLSTATE 'P1031' THEN denied:=true; END;
 IF NOT denied OR EXISTS(SELECT 1 FROM public.mobility_stage_g100_moto_trips
  WHERE passenger_id=passenger)
 THEN RAISE EXCEPTION 'G103 active AUTO must block MOTO booking'; END IF;
 PERFORM public.mobility_stage_g95_cancel_booked_auto_qa(passenger,
  '10300000-0000-4103-8103-000000000012',
  '10300000-0000-4103-8103-000000000013');
 moto_booking:=public.mobility_stage_g100_moto_book_qa(passenger,
  (moto_quote->>'quoteId')::uuid,'10300000-0000-4103-8103-000000000022');
 IF moto_booking->>'tripState'<>'searching'
 OR moto_booking->>'financialState'<>'RESERVED_QA'
 THEN RAISE EXCEPTION 'G103 MOTO after canceled AUTO unavailable'; END IF;
 -- The original already-canceled AUTO G3 request replay cannot create
 -- an active AUTO while MOTO is searching; its old tripId is stable.
 IF public.mobility_stage_g73_book(passenger,quote,
  '10300000-0000-4103-8103-000000000012')<>ride
 THEN RAISE EXCEPTION 'G103 historic AUTO booking replay changed trip'; END IF;
 route:=public.mobility_stage_g73_route(passenger,
  '10300000-0000-4103-8103-000000000030','economico',
  'PANTEON','MERCADO','ASUNCION_FIXTURE',6000,720,0);
 quote:=public.mobility_stage_g73_quote(passenger,route,
  '10300000-0000-4103-8103-000000000031');
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g73_book(passenger,quote,
   '10300000-0000-4103-8103-000000000032');
 EXCEPTION WHEN SQLSTATE 'P1031' THEN denied:=true; END;
 IF NOT denied OR EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips
  WHERE passenger_id=passenger AND status='searching')
 THEN RAISE EXCEPTION 'G103 active MOTO must reject new G73 AUTO'; END IF;
 moto_booking:=public.mobility_stage_g100_moto_cancel_qa(passenger,
 '10300000-0000-4103-8103-000000000022',
 '10300000-0000-4103-8103-000000000023');
 IF moto_booking->>'tripState'<>'cancelled'
 OR moto_booking->>'financialState'<>'VOIDED_QA'
 THEN RAISE EXCEPTION 'G103 blocked MOTO cancellation ledger'; END IF;
 ride:=public.mobility_stage_g73_book(passenger,quote,
  '10300000-0000-4103-8103-000000000032');
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips
  WHERE passenger_id=passenger AND status='searching')<>1
 OR (SELECT count(*) FROM public.mobility_stage_g100_moto_trips
  WHERE passenger_id=passenger AND status='searching')<>0
 THEN RAISE EXCEPTION 'G103 cannot book AUTO after MOTO reversal'; END IF;
 RAISE NOTICE 'G103 PASS: AUTO active denies MOTO; AUTO cancellation allows MOTO; MOTO active denies AUTO; MOTO cancellation allows AUTO; old key stable';
END $f1$;
DO $grants$
BEGIN
 IF has_function_privilege('service_role',
  'public.mobility_stage_g103_one_active_ride_qa()','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g103_one_active_ride_qa()','EXECUTE')
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
  WHERE tgname='mobility_stage_g103_fence_auto' AND NOT tgisinternal)
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
  WHERE tgname='mobility_stage_g103_fence_moto' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'G103 cross-service DB fence privileges or triggers broken'; END IF;
END $grants$;
ROLLBACK;
