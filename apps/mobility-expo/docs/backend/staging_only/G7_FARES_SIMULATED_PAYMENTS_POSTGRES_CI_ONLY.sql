-- QORE G7: versioned fares and SIMULATED payment ledger.
-- POSTGRESQL 16 DISPOSABLE CI ONLY. NEVER deploy remotely or connect a PSP.
-- Requires G3 rides, G5 deliveries and G6 merchant orders.
BEGIN;

CREATE TYPE public.mobility_stage_fare_mode AS ENUM
 ('AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY');
CREATE TYPE public.mobility_stage_fare_subject AS ENUM
 ('RIDE','DELIVERY','MERCHANT_ORDER');
CREATE TYPE public.mobility_stage_payment_method AS ENUM
 ('SIMULATED_CASH','SIMULATED_CARD');
CREATE TYPE public.mobility_stage_payment_status AS ENUM
 ('authorized','captured','refunded','cancelled');

CREATE TABLE public.mobility_stage_fare_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 rule_key text NOT NULL UNIQUE CHECK(rule_key ~ '^[a-zA-Z0-9._-]{1,48}$'),
 mode public.mobility_stage_fare_mode NOT NULL,
 zone_tag text NOT NULL CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 base_pyg integer NOT NULL CHECK(base_pyg BETWEEN 0 AND 1000000),
 per_km_pyg integer NOT NULL CHECK(per_km_pyg BETWEEN 0 AND 100000),
 per_minute_pyg integer NOT NULL CHECK(per_minute_pyg BETWEEN 0 AND 20000),
 minimum_pyg integer NOT NULL CHECK(minimum_pyg BETWEEN 0 AND 1000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 3000),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 active boolean NOT NULL DEFAULT false,
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 approved_at timestamptz NOT NULL,
 CHECK(valid_until>valid_from),
 CHECK(approved_at<=valid_from)
);
CREATE UNIQUE INDEX mobility_stage_one_active_fare_rule
 ON public.mobility_stage_fare_rules(mode,zone_tag)
 WHERE active=true;
CREATE TABLE public.mobility_stage_fare_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id) ON DELETE RESTRICT,
 mode public.mobility_stage_fare_mode NOT NULL,
 subject_kind public.mobility_stage_fare_subject NOT NULL,
 subject_id uuid NOT NULL,
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 0 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 0 AND 86400),
 base_pyg integer NOT NULL CHECK(base_pyg BETWEEN 0 AND 1000000),
 distance_charge_pyg integer NOT NULL CHECK(distance_charge_pyg BETWEEN 0 AND 50000000),
 time_charge_pyg integer NOT NULL CHECK(time_charge_pyg BETWEEN 0 AND 28800000),
 minimum_pyg integer NOT NULL CHECK(minimum_pyg BETWEEN 0 AND 1000000),
 subtotal_pyg integer NOT NULL CHECK(subtotal_pyg BETWEEN 0 AND 100000000),
 tolls_pyg integer NOT NULL CHECK(tolls_pyg BETWEEN 0 AND 1000000),
 total_pyg integer NOT NULL CHECK(total_pyg BETWEEN 0 AND 100000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 3000),
 commission_pyg integer NOT NULL CHECK(commission_pyg BETWEEN 0 AND 100000000),
 provider_pyg integer NOT NULL CHECK(provider_pyg BETWEEN 0 AND 100000000),
 quoted_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CHECK(total_pyg=subtotal_pyg+tolls_pyg),
 CHECK(provider_pyg+commission_pyg=total_pyg),
 CHECK(expires_at>quoted_at),
 UNIQUE(subject_kind,subject_id,request_key)
);
CREATE TABLE public.mobility_stage_payment_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 quote_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_fare_quotes(id) ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 method public.mobility_stage_payment_method NOT NULL,
 amount_pyg integer NOT NULL CHECK(amount_pyg BETWEEN 0 AND 100000000),
 status public.mobility_stage_payment_status NOT NULL DEFAULT 'authorized',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 authorized_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mobility_stage_payment_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 payment_id uuid NOT NULL REFERENCES public.mobility_stage_payment_intents(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('capture','refund','cancel')),
 next_status public.mobility_stage_payment_status NOT NULL,
 payment_revision bigint NOT NULL CHECK(payment_revision>1),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_id,payment_revision)
);
CREATE TABLE public.mobility_stage_ledger_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public.mobility_stage_payment_intents(id) ON DELETE RESTRICT,
 operation_id uuid NOT NULL REFERENCES public.mobility_stage_payment_operations(id) ON DELETE RESTRICT,
 event text NOT NULL CHECK(event IN ('capture','refund')),
 sequence smallint NOT NULL CHECK(sequence BETWEEN 1 AND 3),
 account text NOT NULL CHECK(account IN
  ('synthetic_cash_clearing','synthetic_provider_payable','synthetic_platform_commission')),
 side text NOT NULL CHECK(side IN ('debit','credit')),
 amount_pyg integer NOT NULL CHECK(amount_pyg BETWEEN 0 AND 100000000),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_id,event,sequence)
);

ALTER TABLE public.mobility_stage_fare_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_fare_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_payment_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_ledger_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_fare_rules FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_fare_quotes FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_payment_intents FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_payment_operations FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_ledger_entries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mobility_stage_fare_rules TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_fare_quotes TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_payment_intents TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_payment_operations TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_ledger_entries TO service_role;
GRANT SELECT ON public.mobility_stage_fare_quotes,public.mobility_stage_payment_intents TO authenticated;
CREATE POLICY mobility_stage_own_quote_read ON public.mobility_stage_fare_quotes
 FOR SELECT TO authenticated USING(customer_id=auth.uid());
CREATE POLICY mobility_stage_own_payment_read ON public.mobility_stage_payment_intents
 FOR SELECT TO authenticated USING(customer_id=auth.uid());

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

REVOKE ALL ON FUNCTION public.mobility_stage_fare_quote(uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,uuid,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_payment_authorize(uuid,uuid,public.mobility_stage_payment_method,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_payment_transition(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_fare_quote(uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,uuid,text,integer,integer,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_payment_authorize(uuid,uuid,public.mobility_stage_payment_method,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_payment_transition(uuid,uuid,text,uuid)
 TO service_role;
COMMIT;
