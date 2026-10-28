-- QORE G8: safety incidents, SOS escalation and operational suspensions.
-- POSTGRESQL 16 DISPOSABLE CI ONLY. NEVER deploy remotely or page responders.
-- Requires G3 rides, G5 deliveries, G6 commerce and G7 simulated finance.
BEGIN;

CREATE TYPE public.mobility_stage_safety_subject AS ENUM
 ('RIDE','DELIVERY','MERCHANT_ORDER');
CREATE TYPE public.mobility_stage_incident_category AS ENUM
 ('SOS','SAFETY','LOSS','DISPUTE','FRAUD','QUALITY');
CREATE TYPE public.mobility_stage_incident_severity AS ENUM
 ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE public.mobility_stage_incident_status AS ENUM
 ('open','triaged','investigating','resolved','dismissed');
CREATE TYPE public.mobility_stage_suspension_scope AS ENUM
 ('DRIVER','BUYER','MERCHANT_STAFF');

CREATE TABLE public.mobility_stage_safety_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 subject_kind public.mobility_stage_safety_subject NOT NULL,
 subject_id uuid NOT NULL,
 category public.mobility_stage_incident_category NOT NULL,
 severity public.mobility_stage_incident_severity NOT NULL,
 status public.mobility_stage_incident_status NOT NULL DEFAULT 'open',
 assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK((category='SOS' AND severity='CRITICAL') OR category<>'SOS')
);
CREATE TABLE public.mobility_stage_safety_incident_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 incident_id uuid NOT NULL REFERENCES public.mobility_stage_safety_incidents(id)
  ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN
  ('report','triage','investigate','resolve','dismiss')),
 reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 next_status public.mobility_stage_incident_status NOT NULL,
 incident_revision bigint NOT NULL CHECK(incident_revision>0),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(incident_id,incident_revision)
);
CREATE TABLE public.mobility_stage_operational_suspensions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 scope public.mobility_stage_suspension_scope NOT NULL,
 reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 active boolean NOT NULL DEFAULT true,
 applied_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 applied_at timestamptz NOT NULL DEFAULT now(),
 lifted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 lifted_at timestamptz,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK((active=true AND lifted_by IS NULL AND lifted_at IS NULL) OR
       (active=false AND lifted_by IS NOT NULL AND lifted_at IS NOT NULL))
);
CREATE UNIQUE INDEX mobility_stage_one_active_suspension
 ON public.mobility_stage_operational_suspensions(subject_user_id,scope)
 WHERE active=true;
CREATE TABLE public.mobility_stage_suspension_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 suspension_id uuid NOT NULL
  REFERENCES public.mobility_stage_operational_suspensions(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('apply','lift')),
 reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 suspension_revision bigint NOT NULL CHECK(suspension_revision>0),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(suspension_id,suspension_revision)
);

ALTER TABLE public.mobility_stage_safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_safety_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_operational_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_suspension_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_safety_incidents FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_safety_incident_events FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_operational_suspensions FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_suspension_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_safety_incidents TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_safety_incident_events TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_operational_suspensions TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_suspension_events TO service_role;
GRANT SELECT ON public.mobility_stage_safety_incidents TO authenticated;
CREATE POLICY mobility_stage_reporter_incident_read
 ON public.mobility_stage_safety_incidents FOR SELECT TO authenticated
 USING(reporter_id=auth.uid());

CREATE FUNCTION public.mobility_stage_safety_report(
 _reporter_id uuid,_request_key uuid,
 _subject_kind public.mobility_stage_safety_subject,_subject_id uuid,
 _category public.mobility_stage_incident_category,
 _severity public.mobility_stage_incident_severity
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE old public.mobility_stage_safety_incidents%ROWTYPE;
 out_id uuid; participant boolean:=false; active_service boolean:=false;
BEGIN
 IF _reporter_id IS NULL OR _request_key IS NULL OR _subject_kind IS NULL
 OR _subject_id IS NULL OR _category IS NULL OR _severity IS NULL
 OR (_category='SOS' AND _severity<>'CRITICAL')
 THEN RAISE EXCEPTION 'Invalid safety report'; END IF;
 SELECT * INTO old FROM public.mobility_stage_safety_incidents
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.reporter_id<>_reporter_id OR old.subject_kind<>_subject_kind
   OR old.subject_id<>_subject_id OR old.category<>_category
   OR old.severity<>_severity
  THEN RAISE EXCEPTION 'Conflicting safety report replay'; END IF;
  RETURN old.id;
 END IF;
 participant:=CASE
  WHEN _subject_kind='RIDE' THEN EXISTS(SELECT 1
   FROM public.mobility_stage_auto_demo_trips t WHERE t.id=_subject_id
    AND _reporter_id IN (t.passenger_id,t.driver_id))
  WHEN _subject_kind='DELIVERY' THEN EXISTS(SELECT 1
   FROM public.mobility_stage_deliveries d WHERE d.id=_subject_id
    AND _reporter_id IN (d.sender_id,d.courier_id))
  WHEN _subject_kind='MERCHANT_ORDER' THEN EXISTS(SELECT 1
   FROM public.mobility_stage_merchant_orders o WHERE o.id=_subject_id
    AND (o.buyer_id=_reporter_id OR EXISTS(SELECT 1
     FROM public.mobility_stage_merchant_staff s
     WHERE s.merchant_id=o.merchant_id AND s.user_id=_reporter_id AND s.active=true)))
  ELSE false END;
 IF NOT participant THEN RAISE EXCEPTION 'Safety subject unavailable'; END IF;
 IF _category='SOS' THEN
  active_service:=CASE
   WHEN _subject_kind='RIDE' THEN EXISTS(SELECT 1
    FROM public.mobility_stage_auto_demo_trips WHERE id=_subject_id
     AND status IN ('accepted','arriving','in_progress'))
   WHEN _subject_kind='DELIVERY' THEN EXISTS(SELECT 1
    FROM public.mobility_stage_deliveries WHERE id=_subject_id
     AND status IN ('accepted','picked_up'))
   ELSE false END;
  IF NOT active_service THEN RAISE EXCEPTION 'SOS requires active mobility service'; END IF;
 END IF;
 INSERT INTO public.mobility_stage_safety_incidents
  (request_key,reporter_id,subject_kind,subject_id,category,severity)
 VALUES(_request_key,_reporter_id,_subject_kind,_subject_id,_category,_severity)
 RETURNING id INTO out_id;
 INSERT INTO public.mobility_stage_safety_incident_events
  (request_key,incident_id,actor_id,action,reason_code,next_status,incident_revision)
 VALUES(_request_key,out_id,_reporter_id,'report',
  CASE WHEN _category='SOS' THEN 'SOS_TRIGGERED' ELSE 'USER_REPORTED' END,
  'open',1);
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_safety_transition(
 _incident_id uuid,_admin_id uuid,_action text,_reason_code text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE incident public.mobility_stage_safety_incidents%ROWTYPE;
 old public.mobility_stage_safety_incident_events%ROWTYPE;
 target public.mobility_stage_incident_status; event_id uuid; ver bigint;
BEGIN
 IF _incident_id IS NULL OR _admin_id IS NULL OR _request_key IS NULL
 OR _action NOT IN ('triage','investigate','resolve','dismiss')
 OR _reason_code IS NULL OR _reason_code !~ '^[A-Z][A-Z0-9_]{2,39}$'
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_admin_id AND role='admin'::public.app_role)
 THEN RAISE EXCEPTION 'Verified admin safety transition required'; END IF;
 SELECT * INTO incident FROM public.mobility_stage_safety_incidents
  WHERE id=_incident_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Safety incident missing'; END IF;
 SELECT * INTO old FROM public.mobility_stage_safety_incident_events
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.incident_id<>_incident_id OR old.actor_id<>_admin_id
   OR old.action<>_action OR old.reason_code<>_reason_code
  THEN RAISE EXCEPTION 'Conflicting safety transition replay'; END IF;
  RETURN old.id;
 END IF;
 target:=CASE
  WHEN _action='triage' AND incident.status='open' THEN 'triaged'
  WHEN _action='investigate' AND incident.status='triaged' THEN 'investigating'
  WHEN _action='resolve' AND incident.status IN ('triaged','investigating') THEN 'resolved'
  WHEN _action='dismiss' AND incident.status IN ('open','triaged','investigating') THEN 'dismissed'
  ELSE NULL END;
 IF target IS NULL THEN RAISE EXCEPTION 'Safety transition not authorized'; END IF;
 UPDATE public.mobility_stage_safety_incidents SET status=target,
  assigned_admin_id=_admin_id,revision=revision+1,changed_at=now()
 WHERE id=_incident_id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_safety_incident_events
  (request_key,incident_id,actor_id,action,reason_code,next_status,incident_revision)
 VALUES(_request_key,_incident_id,_admin_id,_action,_reason_code,target,ver)
 RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_suspension_apply(
 _subject_user_id uuid,_scope public.mobility_stage_suspension_scope,
 _admin_id uuid,_reason_code text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE old public.mobility_stage_operational_suspensions%ROWTYPE; out_id uuid;
 eligible boolean:=false;
BEGIN
 IF _subject_user_id IS NULL OR _scope IS NULL OR _admin_id IS NULL
 OR _request_key IS NULL OR _reason_code IS NULL
 OR _reason_code !~ '^[A-Z][A-Z0-9_]{2,39}$'
 OR _subject_user_id=_admin_id
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_admin_id AND role='admin'::public.app_role)
 THEN RAISE EXCEPTION 'Verified admin suspension required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(_subject_user_id::text||':'||_scope::text,0));
 SELECT * INTO old FROM public.mobility_stage_operational_suspensions
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.subject_user_id<>_subject_user_id OR old.scope<>_scope
   OR old.applied_by<>_admin_id OR old.reason_code<>_reason_code
  THEN RAISE EXCEPTION 'Conflicting suspension replay'; END IF;
  RETURN old.id;
 END IF;
 eligible:=CASE
  WHEN _scope='DRIVER' THEN EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_subject_user_id AND role='driver'::public.app_role)
  WHEN _scope='BUYER' THEN EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_subject_user_id AND role='passenger'::public.app_role)
  WHEN _scope='MERCHANT_STAFF' THEN EXISTS(SELECT 1
   FROM public.mobility_stage_merchant_staff
   WHERE user_id=_subject_user_id AND active=true)
  ELSE false END;
 IF NOT eligible OR EXISTS(SELECT 1 FROM public.mobility_stage_operational_suspensions
  WHERE subject_user_id=_subject_user_id AND scope=_scope AND active=true)
 THEN RAISE EXCEPTION 'Suspension target unavailable'; END IF;
 INSERT INTO public.mobility_stage_operational_suspensions
  (request_key,subject_user_id,scope,reason_code,applied_by)
 VALUES(_request_key,_subject_user_id,_scope,_reason_code,_admin_id)
 RETURNING id INTO out_id;
 INSERT INTO public.mobility_stage_suspension_events
  (request_key,suspension_id,actor_id,action,reason_code,suspension_revision)
 VALUES(_request_key,out_id,_admin_id,'apply',_reason_code,1);
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_suspension_lift(
 _suspension_id uuid,_admin_id uuid,_reason_code text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE suspension public.mobility_stage_operational_suspensions%ROWTYPE;
 old public.mobility_stage_suspension_events%ROWTYPE; event_id uuid; ver bigint;
BEGIN
 IF _suspension_id IS NULL OR _admin_id IS NULL OR _request_key IS NULL
 OR _reason_code IS NULL OR _reason_code !~ '^[A-Z][A-Z0-9_]{2,39}$'
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_admin_id AND role='admin'::public.app_role)
 THEN RAISE EXCEPTION 'Verified admin suspension lift required'; END IF;
 SELECT * INTO suspension FROM public.mobility_stage_operational_suspensions
  WHERE id=_suspension_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Suspension missing'; END IF;
 SELECT * INTO old FROM public.mobility_stage_suspension_events
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.suspension_id<>_suspension_id OR old.actor_id<>_admin_id
   OR old.action<>'lift' OR old.reason_code<>_reason_code
  THEN RAISE EXCEPTION 'Conflicting suspension lift replay'; END IF;
  RETURN old.id;
 END IF;
 IF suspension.active<>true THEN RAISE EXCEPTION 'Suspension already inactive'; END IF;
 UPDATE public.mobility_stage_operational_suspensions SET active=false,
  lifted_by=_admin_id,lifted_at=now(),revision=revision+1
 WHERE id=_suspension_id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_suspension_events
  (request_key,suspension_id,actor_id,action,reason_code,suspension_revision)
 VALUES(_request_key,_suspension_id,_admin_id,'lift',_reason_code,ver)
 RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;

-- Central write-time enforcement protects every new operation even if a
-- caller bypasses an HTTP gateway and reaches the server-owned RPC directly.
CREATE FUNCTION public.mobility_stage_reject_suspended_operation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE blocked boolean:=false; new_row jsonb:=pg_catalog.to_jsonb(NEW);
 old_row jsonb:=COALESCE(pg_catalog.to_jsonb(OLD),'{}'::jsonb);
BEGIN
 blocked:=CASE TG_TABLE_NAME
  WHEN 'mobility_stage_auto_demo_trips' THEN
   (TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.mobility_stage_operational_suspensions
     WHERE subject_user_id=(new_row->>'passenger_id')::uuid
      AND scope='BUYER' AND active=true))
   OR (TG_OP='UPDATE' AND old_row->>'driver_id' IS DISTINCT FROM new_row->>'driver_id'
    AND new_row->>'driver_id' IS NOT NULL AND
    EXISTS(SELECT 1 FROM public.mobility_stage_operational_suspensions
     WHERE subject_user_id=(new_row->>'driver_id')::uuid
      AND scope='DRIVER' AND active=true))
  WHEN 'mobility_stage_auto_demo_offers' THEN
   (TG_OP='INSERT' OR (TG_OP='UPDATE' AND old_row->>'status' IS DISTINCT FROM new_row->>'status'
    AND new_row->>'status'='accepted')) AND EXISTS(SELECT 1
     FROM public.mobility_stage_operational_suspensions
     WHERE subject_user_id=(new_row->>'driver_id')::uuid
      AND scope='DRIVER' AND active=true)
  WHEN 'mobility_stage_deliveries' THEN
   (TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.mobility_stage_operational_suspensions
     WHERE subject_user_id=(new_row->>'sender_id')::uuid
      AND scope='BUYER' AND active=true))
   OR (TG_OP='UPDATE' AND old_row->>'courier_id' IS DISTINCT FROM new_row->>'courier_id'
    AND new_row->>'courier_id' IS NOT NULL AND
    EXISTS(SELECT 1 FROM public.mobility_stage_operational_suspensions
     WHERE subject_user_id=(new_row->>'courier_id')::uuid
      AND scope='DRIVER' AND active=true))
  WHEN 'mobility_stage_merchant_orders' THEN TG_OP='INSERT' AND EXISTS(SELECT 1
   FROM public.mobility_stage_operational_suspensions
   WHERE subject_user_id=(new_row->>'buyer_id')::uuid
    AND scope='BUYER' AND active=true)
  WHEN 'mobility_stage_fare_quotes' THEN EXISTS(SELECT 1
   FROM public.mobility_stage_operational_suspensions
   WHERE subject_user_id=(new_row->>'customer_id')::uuid
    AND scope='BUYER' AND active=true)
  WHEN 'mobility_stage_payment_intents' THEN EXISTS(SELECT 1
   FROM public.mobility_stage_operational_suspensions
   WHERE subject_user_id=(new_row->>'customer_id')::uuid
    AND scope='BUYER' AND active=true)
  ELSE true END;
 IF blocked THEN RAISE EXCEPTION 'Operational suspension blocks action'; END IF;
 RETURN NEW;
END
$body$;
CREATE TRIGGER mobility_stage_trip_suspension_gate
 BEFORE INSERT OR UPDATE ON public.mobility_stage_auto_demo_trips
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_reject_suspended_operation();
CREATE TRIGGER mobility_stage_offer_suspension_gate
 BEFORE INSERT OR UPDATE ON public.mobility_stage_auto_demo_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_reject_suspended_operation();
CREATE TRIGGER mobility_stage_delivery_suspension_gate
 BEFORE INSERT OR UPDATE ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_reject_suspended_operation();
CREATE TRIGGER mobility_stage_order_suspension_gate
 BEFORE INSERT OR UPDATE ON public.mobility_stage_merchant_orders
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_reject_suspended_operation();
CREATE TRIGGER mobility_stage_quote_suspension_gate
 BEFORE INSERT ON public.mobility_stage_fare_quotes
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_reject_suspended_operation();
CREATE TRIGGER mobility_stage_payment_suspension_gate
 BEFORE INSERT ON public.mobility_stage_payment_intents
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_reject_suspended_operation();

REVOKE ALL ON FUNCTION public.mobility_stage_safety_report(uuid,uuid,public.mobility_stage_safety_subject,uuid,public.mobility_stage_incident_category,public.mobility_stage_incident_severity)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_safety_transition(uuid,uuid,text,text,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_suspension_apply(uuid,public.mobility_stage_suspension_scope,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_suspension_lift(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_reject_suspended_operation()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_safety_report(uuid,uuid,public.mobility_stage_safety_subject,uuid,public.mobility_stage_incident_category,public.mobility_stage_incident_severity)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_safety_transition(uuid,uuid,text,text,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_suspension_apply(uuid,public.mobility_stage_suspension_scope,uuid,text,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_suspension_lift(uuid,uuid,text,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_reject_suspended_operation()
 TO service_role;
COMMIT;
