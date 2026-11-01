\set ON_ERROR_STOP on
-- G306 TEST ONLY; disposable PostgreSQL16 with synthetic G173 stub.
-- Never send this file to actual Supabase. No real PSP or identities.
DO $roles$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $roles$;

CREATE TABLE public.mobility_stage_merchant_orders(
 id uuid PRIMARY KEY,buyer_id uuid NOT NULL,subtotal_pyg integer NOT NULL,
 status text NOT NULL,created_at timestamptz NOT NULL);
CREATE TABLE public.mobility_stage_fare_quotes(
 id uuid PRIMARY KEY,customer_id uuid NOT NULL,subject_id uuid NOT NULL,
 subject_kind text NOT NULL,total_pyg integer NOT NULL,
 expires_at timestamptz NOT NULL);
CREATE TABLE public.g306_disposable_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_key uuid NOT NULL UNIQUE,
 order_id uuid NOT NULL,action text NOT NULL);
GRANT SELECT,UPDATE ON public.mobility_stage_merchant_orders TO service_role;
GRANT SELECT ON public.mobility_stage_fare_quotes TO service_role;
GRANT SELECT,INSERT ON public.g306_disposable_events TO service_role;

CREATE OR REPLACE FUNCTION public.mobility_stage_g173_merchant_transition_qa(
 _actor uuid,_session uuid,_iat bigint,_order uuid,_action text,_request uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $g173stub$
DECLARE prior uuid; output uuid; prior_status text;next_status text;
BEGIN
 IF _actor<>'33333333-3333-4333-8333-333333333333'::uuid OR
    _session<>'44444444-4444-4444-8444-444444444444'::uuid OR
    _iat<1 THEN RAISE EXCEPTION 'G173 staff/session rejected'; END IF;
 SELECT id INTO prior FROM public.g306_disposable_events WHERE request_key=_request;
 IF FOUND THEN RETURN prior; END IF;
 SELECT status INTO prior_status FROM public.mobility_stage_merchant_orders WHERE id=_order FOR UPDATE;
 next_status:=CASE
  WHEN _action='confirm' AND prior_status='requested' THEN 'confirmed'
  WHEN _action='start_preparing' AND prior_status='confirmed' THEN 'preparing'
  WHEN _action='ready' AND prior_status='preparing' THEN 'ready'
  ELSE NULL END;
 IF next_status IS NULL THEN RAISE EXCEPTION 'G173 transition forbidden'; END IF;
 UPDATE public.mobility_stage_merchant_orders SET status=next_status WHERE id=_order;
 INSERT INTO public.g306_disposable_events(request_key,order_id,action)
 VALUES(_request,_order,_action) RETURNING id INTO output;
 RETURN output;
END $g173stub$;
REVOKE ALL ON FUNCTION public.mobility_stage_g173_merchant_transition_qa(
 uuid,uuid,bigint,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g173_merchant_transition_qa(
 uuid,uuid,bigint,uuid,text,uuid) TO service_role;

\ir ../../docs/g306-atomic-commerce-prepay-pg17-draft.sql

DO $check$ BEGIN
 IF has_table_privilege('authenticated',
  'qore_stage_internal.mobility_stage_g306_prepaid_receipts','SELECT')
 OR has_table_privilege('authenticated',
  'qore_stage_internal.mobility_stage_g306_prepaid_receipts','INSERT')
 OR has_table_privilege('anon',
  'qore_stage_internal.mobility_stage_g306_prepaid_receipts','SELECT')
 OR has_function_privilege('authenticated',
  'qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(uuid,uuid,bigint,uuid,text,uuid)',
  'EXECUTE')
 OR has_table_privilege('service_role',
  'qore_stage_internal.mobility_stage_g306_prepaid_receipts','DELETE')
 THEN RAISE EXCEPTION 'G306 permissions leak'; END IF;
END $check$;

INSERT INTO public.mobility_stage_merchant_orders(id,buyer_id,subtotal_pyg,status,created_at)
 VALUES('11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',100000,
        'requested',clock_timestamp()-interval '5 minutes');
INSERT INTO public.mobility_stage_fare_quotes(
 id,customer_id,subject_id,subject_kind,total_pyg,expires_at)
 VALUES('55555555-5555-4555-8555-555555555555',
        '22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111','MERCHANT_ORDER',15000,
        clock_timestamp()+interval '10 minutes');

-- Foreign/authenticated clients cannot call the private function even
-- with full knowledge of IDs.
SET ROLE authenticated;
DO $denied$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',1,
  '11111111-1111-4111-8111-111111111111','confirm',
  '66666666-6666-4666-8666-666666666666');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'G306 authenticated client executed privileged payment transition'; END IF;
END $denied$;
RESET ROLE;
SET ROLE service_role;

DO $cases$ DECLARE
 booked uuid:='11111111-1111-4111-8111-111111111111';
 actor uuid:='33333333-3333-4333-8333-333333333333';
 session uuid:='44444444-4444-4444-8444-444444444444';
 key1 uuid:='66666666-6666-4666-8666-666666666666';
 key2 uuid:='77777777-7777-4777-8777-777777777777';
 paid uuid;replay uuid;blocked boolean;
BEGIN
 -- No payment receipt: forbidden before G173 is ever invoked.
 blocked:=false;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
   actor,session,1,booked,'confirm',key1);
 EXCEPTION WHEN SQLSTATE 'P3063' THEN blocked:=true; END;
 IF NOT blocked OR (SELECT count(*) FROM public.g306_disposable_events)<>0
 THEN RAISE EXCEPTION 'G306 missing payment not blocked'; END IF;

 INSERT INTO qore_stage_internal.mobility_stage_g306_prepaid_receipts(
  order_id,quote_id,buyer_id,provider,psp_payment_ref,provider_event_ref,
  payment_method,provider_state,captured_pyg,
  signed_callback_verified,independent_lookup_verified,captured_at)
 VALUES(booked,'55555555-5555-4555-8555-555555555555',
 '22222222-2222-4222-8222-222222222222','PSP_QA_SIGNED_PROVIDER',
 'psp-merchant-charge-00001','psp-merchant-event-00001',
 'CARD','CAPTURED',115000,true,true,clock_timestamp()-interval '1 minute');

 -- Rejected foreign buyer and incorrect total; no G173 event created.
 UPDATE qore_stage_internal.mobility_stage_g306_prepaid_receipts
 SET buyer_id='99999999-9999-4999-8999-999999999999' WHERE order_id=booked;
 blocked:=false;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
   actor,session,1,booked,'confirm',key1);
 EXCEPTION WHEN SQLSTATE 'P3063' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G306 foreign buyer accepted'; END IF;
 UPDATE qore_stage_internal.mobility_stage_g306_prepaid_receipts
 SET buyer_id='22222222-2222-4222-8222-222222222222',
 captured_pyg=114999 WHERE order_id=booked;
 blocked:=false;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
   actor,session,1,booked,'confirm',key1);
 EXCEPTION WHEN SQLSTATE 'P3064' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G306 wrong amount accepted'; END IF;
 UPDATE qore_stage_internal.mobility_stage_g306_prepaid_receipts
 SET captured_pyg=115000,provider_state='REFUNDED' WHERE order_id=booked;
 blocked:=false;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
   actor,session,1,booked,'confirm',key1);
 EXCEPTION WHEN SQLSTATE 'P3063' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G306 refunded charge accepted'; END IF;

 UPDATE qore_stage_internal.mobility_stage_g306_prepaid_receipts
 SET provider_state='CAPTURED' WHERE order_id=booked;
 paid:=qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
  actor,session,1,booked,'confirm',key1);
 replay:=qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
  actor,session,1,booked,'confirm',key1);
 IF paid IS NULL OR paid<>replay OR
  (SELECT count(*) FROM public.g306_disposable_events)<>1 OR
  (SELECT status FROM public.mobility_stage_merchant_orders WHERE id=booked)<>'confirmed'
 THEN RAISE EXCEPTION 'G306 confirmed receipt not idempotent'; END IF;

 UPDATE qore_stage_internal.mobility_stage_g306_prepaid_receipts
 SET revoked_at=clock_timestamp() WHERE order_id=booked;
 blocked:=false;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
   actor,session,1,booked,'start_preparing',key2);
 EXCEPTION WHEN SQLSTATE 'P3063' THEN blocked:=true; END;
 IF NOT blocked OR (SELECT count(*) FROM public.g306_disposable_events)<>1
 THEN RAISE EXCEPTION 'G306 reversal did not halt preparation'; END IF;
 UPDATE qore_stage_internal.mobility_stage_g306_prepaid_receipts
 SET revoked_at=NULL WHERE order_id=booked;
 PERFORM qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
  actor,session,1,booked,'start_preparing',key2);
 IF (SELECT status FROM public.mobility_stage_merchant_orders WHERE id=booked)<>'preparing'
  OR (SELECT count(*) FROM public.g306_disposable_events)<>2
 THEN RAISE EXCEPTION 'G306 prep did not atomically commit'; END IF;
END $cases$;
RESET ROLE;
\echo G306 PASS: unique signed PSP capture + locked original order + matching fare, private SQL, idempotent transition and reversal hold; NO LIVE.
