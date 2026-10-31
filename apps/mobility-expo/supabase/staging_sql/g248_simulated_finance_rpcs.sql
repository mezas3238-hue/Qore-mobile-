-- G248 persistent STAGING simulation ONLY: fare quote + fake payment ledger.
-- No PSP, real capture, card token or LIVE transaction. Existing enum values
-- must contain SIMULATED methods exclusively. Adapted from G7 disposable CI.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.mobility_stage_fare_quotes') IS NULL
 OR to_regclass('public.mobility_stage_fare_rules') IS NULL
 OR to_regclass('public.mobility_stage_payment_intents') IS NULL
 OR to_regclass('public.mobility_stage_payment_operations') IS NULL
 OR to_regclass('public.mobility_stage_ledger_entries') IS NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('mobility_stage_fare_quote','mobility_stage_payment_authorize','mobility_stage_payment_transition'))
 OR (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
  JOIN pg_namespace n ON n.oid=t.typnamespace
  WHERE n.nspname='public' AND t.typname='mobility_stage_payment_method'
    AND e.enumlabel IN ('SIMULATED_CASH','SIMULATED_CARD')) <> 2
 OR EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
  JOIN pg_namespace n ON n.oid=t.typnamespace
  WHERE n.nspname='public' AND t.typname='mobility_stage_payment_method'
    AND e.enumlabel NOT IN ('SIMULATED_CASH','SIMULATED_CARD'))
 THEN RAISE EXCEPTION 'G248 simulated-finance prerequisites or payment methods not safe'; END IF;
END $guard$;

CREATE FUNCTION public.mobility_stage_fare_quote(
 _customer_id uuid,_request_key uuid,_mode public.mobility_stage_fare_mode,
 _subject_kind public.mobility_stage_fare_subject,_subject_id uuid,_zone_tag text,
 _distance_meters integer,_duration_seconds integer,_tolls_pyg integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE old public.mobility_stage_fare_quotes%ROWTYPE;
 rule public.mobility_stage_fare_rules%ROWTYPE; out_id uuid;
 distance_charge bigint; time_charge bigint; subtotal bigint;
 total bigint; commission bigint; provider bigint; owned boolean:=false;
BEGIN
 IF _customer_id IS NULL OR _request_key IS NULL OR _mode IS NULL
 OR _subject_kind IS NULL OR _subject_id IS NULL OR _zone_tag IS NULL
 OR _zone_tag !~ '^[A-Z_]{3,40}$' OR _distance_meters NOT BETWEEN 0 AND 500000
 OR _duration_seconds NOT BETWEEN 0 AND 86400 OR _tolls_pyg NOT BETWEEN 0 AND 1000000
 THEN RAISE EXCEPTION 'Invalid fare quote request'; END IF;
 SELECT * INTO old FROM public.mobility_stage_fare_quotes WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.customer_id<>_customer_id OR old.mode<>_mode OR old.subject_kind<>_subject_kind
   OR old.subject_id<>_subject_id OR old.distance_meters<>_distance_meters
   OR old.duration_seconds<>_duration_seconds OR old.tolls_pyg<>_tolls_pyg
  THEN RAISE EXCEPTION 'Conflicting fare quote request key'; END IF;
  RETURN old.id;
 END IF;
 owned:=CASE
  WHEN _subject_kind='RIDE' AND _mode='AUTO' THEN EXISTS(
   SELECT 1 FROM public.mobility_stage_auto_demo_trips t
   WHERE t.id=_subject_id AND t.passenger_id=_customer_id)
  WHEN _subject_kind='DELIVERY' AND _mode='DELIVERY' THEN EXISTS(
   SELECT 1 FROM public.mobility_stage_deliveries d
   WHERE d.id=_subject_id AND d.sender_id=_customer_id)
  WHEN _subject_kind='MERCHANT_ORDER' AND _mode='MERCHANT_DELIVERY' THEN EXISTS(
   SELECT 1 FROM public.mobility_stage_merchant_orders o
   WHERE o.id=_subject_id AND o.buyer_id=_customer_id)
  ELSE false END;
 IF NOT owned THEN RAISE EXCEPTION 'Fare subject unavailable'; END IF;
 SELECT * INTO rule FROM public.mobility_stage_fare_rules
  WHERE mode=_mode AND zone_tag=_zone_tag AND active=true
   AND valid_from<=statement_timestamp() AND valid_until>statement_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'No approved active fare rule'; END IF;
 distance_charge:=(_distance_meters::bigint*rule.per_km_pyg+500)/1000;
 time_charge:=(_duration_seconds::bigint*rule.per_minute_pyg+30)/60;
 subtotal:=GREATEST(rule.minimum_pyg,
  rule.base_pyg::bigint+distance_charge+time_charge);
 total:=subtotal+_tolls_pyg;
 commission:=(subtotal*rule.commission_bps+5000)/10000;
 provider:=total-commission;
 IF total>100000000 OR provider<0 THEN RAISE EXCEPTION 'Fare limit exceeded'; END IF;
 INSERT INTO public.mobility_stage_fare_quotes
  (request_key,customer_id,rule_id,mode,subject_kind,subject_id,distance_meters,
   duration_seconds,base_pyg,distance_charge_pyg,time_charge_pyg,minimum_pyg,
   subtotal_pyg,tolls_pyg,total_pyg,commission_bps,commission_pyg,provider_pyg,
   expires_at)
 VALUES(_request_key,_customer_id,rule.id,_mode,_subject_kind,_subject_id,
  _distance_meters,_duration_seconds,rule.base_pyg,distance_charge,time_charge,
  rule.minimum_pyg,subtotal,_tolls_pyg,total,rule.commission_bps,commission,
  provider,statement_timestamp()+interval '5 minutes') RETURNING id INTO out_id;
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_payment_authorize(
 _customer_id uuid,_quote_id uuid,_method public.mobility_stage_payment_method,
 _request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE q public.mobility_stage_fare_quotes%ROWTYPE;
 old public.mobility_stage_payment_intents%ROWTYPE; out_id uuid;
BEGIN
 IF _customer_id IS NULL OR _quote_id IS NULL OR _method IS NULL OR _request_key IS NULL
 THEN RAISE EXCEPTION 'Invalid simulated payment authorization'; END IF;
 -- Quotes are immutable and service_role intentionally has no UPDATE grant.
 -- Serialize every authorization attempt for the quote without weakening that
 -- permission boundary, then re-check idempotency inside the critical section.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(_quote_id::text,0));
 SELECT * INTO old FROM public.mobility_stage_payment_intents WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.customer_id<>_customer_id OR old.quote_id<>_quote_id OR old.method<>_method
  THEN RAISE EXCEPTION 'Conflicting payment authorization replay'; END IF;
  RETURN old.id;
 END IF;
 SELECT * INTO q FROM public.mobility_stage_fare_quotes WHERE id=_quote_id;
 IF NOT FOUND OR q.customer_id<>_customer_id OR q.expires_at<=statement_timestamp()
 THEN RAISE EXCEPTION 'Fare quote expired or unavailable'; END IF;
 INSERT INTO public.mobility_stage_payment_intents
  (request_key,quote_id,customer_id,method,amount_pyg)
 VALUES(_request_key,q.id,_customer_id,_method,q.total_pyg) RETURNING id INTO out_id;
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_payment_transition(
 _payment_id uuid,_actor_id uuid,_action text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE p public.mobility_stage_payment_intents%ROWTYPE;
 q public.mobility_stage_fare_quotes%ROWTYPE;
 old public.mobility_stage_payment_operations%ROWTYPE;
 target public.mobility_stage_payment_status; operation_id uuid; ver bigint;
 service_complete boolean:=false;
BEGIN
 IF _payment_id IS NULL OR _actor_id IS NULL OR _action IS NULL OR _request_key IS NULL
 OR _action NOT IN ('capture','refund','cancel')
 THEN RAISE EXCEPTION 'Invalid simulated payment transition'; END IF;
 SELECT * INTO p FROM public.mobility_stage_payment_intents WHERE id=_payment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Simulated payment not found'; END IF;
 SELECT * INTO old FROM public.mobility_stage_payment_operations WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.payment_id<>_payment_id OR old.actor_id<>_actor_id OR old.action<>_action
  THEN RAISE EXCEPTION 'Conflicting payment transition replay'; END IF;
  RETURN old.id;
 END IF;
 SELECT * INTO q FROM public.mobility_stage_fare_quotes WHERE id=p.quote_id;
 IF q.customer_id<>_actor_id THEN RAISE EXCEPTION 'Payment actor not authorized'; END IF;
 service_complete:=CASE
  WHEN q.subject_kind='RIDE' THEN EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips
   WHERE id=q.subject_id AND passenger_id=_actor_id AND status='completed')
  WHEN q.subject_kind='DELIVERY' THEN EXISTS(SELECT 1 FROM public.mobility_stage_deliveries
   WHERE id=q.subject_id AND sender_id=_actor_id AND status='delivered')
  WHEN q.subject_kind='MERCHANT_ORDER' THEN EXISTS(SELECT 1 FROM public.mobility_stage_merchant_orders
   WHERE id=q.subject_id AND buyer_id=_actor_id AND status='delivered')
  ELSE false END;
 target:=CASE
  WHEN _action='capture' AND p.status='authorized' AND service_complete THEN 'captured'
  WHEN _action='refund' AND p.status='captured' THEN 'refunded'
  WHEN _action='cancel' AND p.status='authorized' THEN 'cancelled'
  ELSE NULL END;
 IF target IS NULL THEN RAISE EXCEPTION 'Payment state not authorized'; END IF;
 UPDATE public.mobility_stage_payment_intents SET status=target,
  revision=revision+1,changed_at=now() WHERE id=p.id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_payment_operations
  (request_key,payment_id,actor_id,action,next_status,payment_revision)
 VALUES(_request_key,p.id,_actor_id,_action,target,ver) RETURNING id INTO operation_id;
 IF _action IN ('capture','refund') THEN
  INSERT INTO public.mobility_stage_ledger_entries
   (payment_id,operation_id,event,sequence,account,side,amount_pyg)
  VALUES
   (p.id,operation_id,_action,1,'synthetic_cash_clearing',
    CASE WHEN _action='capture' THEN 'debit' ELSE 'credit' END,q.total_pyg),
   (p.id,operation_id,_action,2,'synthetic_provider_payable',
    CASE WHEN _action='capture' THEN 'credit' ELSE 'debit' END,q.provider_pyg),
   (p.id,operation_id,_action,3,'synthetic_platform_commission',
    CASE WHEN _action='capture' THEN 'credit' ELSE 'debit' END,q.commission_pyg);
 END IF;
 RETURN operation_id;
END
$body$;

REVOKE EXECUTE ON FUNCTION public.mobility_stage_fare_quote(uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,uuid,text,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_fare_quote(uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,uuid,text,integer,integer,integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_payment_authorize(uuid,uuid,public.mobility_stage_payment_method,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_payment_authorize(uuid,uuid,public.mobility_stage_payment_method,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_payment_transition(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_payment_transition(uuid,uuid,text,uuid) TO service_role;
COMMIT;
