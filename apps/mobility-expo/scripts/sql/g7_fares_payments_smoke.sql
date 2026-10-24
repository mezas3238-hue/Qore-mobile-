\set ON_ERROR_STOP on
-- G7 fares and payments remain synthetic inside disposable PostgreSQL 16.
\ir ../../docs/backend/staging_only/G7_FARES_SIMULATED_PAYMENTS_POSTGRES_CI_ONLY.sql

DO $check$ BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_fare_quote(uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,uuid,text,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_payment_authorize(uuid,uuid,public.mobility_stage_payment_method,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_payment_transition(uuid,uuid,text,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_fare_rules','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_fare_quotes','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_ledger_entries','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_ledger_entries','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_ledger_entries','DELETE')
 THEN RAISE EXCEPTION 'G7 pricing, payment or ledger authority exposed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_enum e JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
  WHERE t.typname='mobility_stage_payment_method'
   AND e.enumlabel NOT LIKE 'SIMULATED_%')
 THEN RAISE EXCEPTION 'Real payment method enabled'; END IF;
END $check$;

INSERT INTO public.mobility_stage_fare_rules
 (id,rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,
  commission_bps,valid_from,valid_until,active,approved_by,approved_at)
VALUES
 ('70000000-0000-4000-8000-000000000001','merchant-staging-v1',
  'MERCHANT_DELIVERY','ASUNCION_FIXTURE',4000,1500,100,7000,1000,
  now()-interval '1 hour',now()+interval '1 day',true,
  '22222222-2222-4222-8222-222222222222',now()-interval '2 hours'),
 ('70000000-0000-4000-8000-000000000002','delivery-staging-v1',
  'DELIVERY','ASUNCION_FIXTURE',3500,1400,80,6500,900,
  now()-interval '1 hour',now()+interval '1 day',true,
  '22222222-2222-4222-8222-222222222222',now()-interval '2 hours'),
 ('70000000-0000-4000-8000-000000000003','moto-staging-disabled-v1',
  'MOTO','ASUNCION_FIXTURE',2500,900,50,4500,800,
  now()-interval '1 hour',now()+interval '1 day',true,
  '22222222-2222-4222-8222-222222222222',now()-interval '2 hours');

SET ROLE service_role;
DO $check$
DECLARE completed_order uuid; cancelled_order uuid; quote_id uuid; quote_replay uuid;
 payment_id uuid; capture_id uuid; refund_id uuid; cancelled_payment uuid;
 blocked boolean; debits bigint; credits bigint; n integer;
BEGIN
 SELECT id INTO completed_order FROM public.mobility_stage_merchant_orders
  WHERE request_key='61000000-0000-4000-8000-000000000001' AND status='delivered';
 SELECT id INTO cancelled_order FROM public.mobility_stage_merchant_orders
  WHERE request_key='61000000-0000-4000-8000-000000000003' AND status='cancelled';
 IF completed_order IS NULL OR cancelled_order IS NULL
 THEN RAISE EXCEPTION 'G6 order fixtures missing'; END IF;
 quote_id:=public.mobility_stage_fare_quote(
  '33333333-3333-4333-8333-333333333333',
  '71000000-0000-4000-8000-000000000001','MERCHANT_DELIVERY','MERCHANT_ORDER',
  completed_order,'ASUNCION_FIXTURE',5000,900,2000);
 quote_replay:=public.mobility_stage_fare_quote(
  '33333333-3333-4333-8333-333333333333',
  '71000000-0000-4000-8000-000000000001','MERCHANT_DELIVERY','MERCHANT_ORDER',
  completed_order,'ASUNCION_FIXTURE',5000,900,2000);
 IF quote_id<>quote_replay OR
  (SELECT subtotal_pyg FROM public.mobility_stage_fare_quotes WHERE id=quote_id)<>13000
 OR (SELECT total_pyg FROM public.mobility_stage_fare_quotes WHERE id=quote_id)<>15000
 OR (SELECT commission_pyg FROM public.mobility_stage_fare_quotes WHERE id=quote_id)<>1300
 OR (SELECT provider_pyg FROM public.mobility_stage_fare_quotes WHERE id=quote_id)<>13700
 THEN RAISE EXCEPTION 'Versioned integer fare calculation inconsistent'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_fare_quote(
   '33333333-3333-4333-8333-333333333333',
   '71000000-0000-4000-8000-000000000002','MOTO','RIDE',
   completed_order,'ASUNCION_FIXTURE',1000,300,0);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'MOTO quote bypassed missing legal ride subject'; END IF;

 payment_id:=public.mobility_stage_payment_authorize(
  '33333333-3333-4333-8333-333333333333',quote_id,'SIMULATED_CARD',
  '72000000-0000-4000-8000-000000000001');
 IF payment_id<>public.mobility_stage_payment_authorize(
  '33333333-3333-4333-8333-333333333333',quote_id,'SIMULATED_CARD',
  '72000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Payment authorization replay duplicated'; END IF;
 capture_id:=public.mobility_stage_payment_transition(payment_id,
  '33333333-3333-4333-8333-333333333333','capture',
  '73000000-0000-4000-8000-000000000001');
 refund_id:=public.mobility_stage_payment_transition(payment_id,
  '33333333-3333-4333-8333-333333333333','refund',
  '73000000-0000-4000-8000-000000000002');
 IF capture_id IS NULL OR refund_id IS NULL OR
  (SELECT status FROM public.mobility_stage_payment_intents WHERE id=payment_id)<>'refunded'
 THEN RAISE EXCEPTION 'Simulated capture/refund state inconsistent'; END IF;
 SELECT COALESCE(sum(amount_pyg) FILTER(WHERE side='debit'),0),
  COALESCE(sum(amount_pyg) FILTER(WHERE side='credit'),0),count(*)
 INTO debits,credits,n FROM public.mobility_stage_ledger_entries l
 WHERE l.payment_id=(SELECT id FROM public.mobility_stage_payment_intents
  WHERE request_key='72000000-0000-4000-8000-000000000001') AND event='capture';
 IF debits<>credits OR n<>3 THEN RAISE EXCEPTION 'Capture ledger unbalanced'; END IF;
 SELECT COALESCE(sum(amount_pyg) FILTER(WHERE side='debit'),0),
  COALESCE(sum(amount_pyg) FILTER(WHERE side='credit'),0),count(*)
 INTO debits,credits,n FROM public.mobility_stage_ledger_entries l
 WHERE l.payment_id=(SELECT id FROM public.mobility_stage_payment_intents
  WHERE request_key='72000000-0000-4000-8000-000000000001') AND event='refund';
 IF debits<>credits OR n<>3 THEN RAISE EXCEPTION 'Refund ledger unbalanced'; END IF;

 quote_id:=public.mobility_stage_fare_quote(
  '88888888-8888-4888-8888-888888888888',
  '71000000-0000-4000-8000-000000000003','MERCHANT_DELIVERY','MERCHANT_ORDER',
  cancelled_order,'ASUNCION_FIXTURE',2000,600,0);
 cancelled_payment:=public.mobility_stage_payment_authorize(
  '88888888-8888-4888-8888-888888888888',quote_id,'SIMULATED_CASH',
  '72000000-0000-4000-8000-000000000002');
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_payment_transition(cancelled_payment,
   '88888888-8888-4888-8888-888888888888','capture',
   '73000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Payment captured before completed service'; END IF;
 PERFORM public.mobility_stage_payment_transition(cancelled_payment,
  '88888888-8888-4888-8888-888888888888','cancel',
  '73000000-0000-4000-8000-000000000004');
END $check$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$ DECLARE q integer; p integer; blocked boolean:=false; BEGIN
 SELECT count(*) INTO q FROM public.mobility_stage_fare_quotes;
 SELECT count(*) INTO p FROM public.mobility_stage_payment_intents;
 IF q<>1 OR p<>1 THEN RAISE EXCEPTION 'Customer cannot read own quote/payment'; END IF;
 BEGIN UPDATE public.mobility_stage_payment_intents SET status='captured';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Customer mutated payment truth'; END IF;
END $check$;
SET request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
DO $check$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_payment_intents;
 IF n<>0 THEN RAISE EXCEPTION 'Outsider can see payment'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G7 versioned integer PYG fares, simulated authorization/capture/refund and balanced private ledger.
