\set ON_ERROR_STOP on
-- G8 safety/operations stays inside disposable PostgreSQL 16.
\ir ../../docs/backend/staging_only/G8_SAFETY_OPERATIONS_POSTGRES_CI_ONLY.sql

DO $check$ BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_safety_report(uuid,uuid,public.mobility_stage_safety_subject,uuid,public.mobility_stage_incident_category,public.mobility_stage_incident_severity)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_suspension_apply(uuid,public.mobility_stage_suspension_scope,uuid,text,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_safety_incident_events','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_operational_suspensions','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_safety_incident_events','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_suspension_events','DELETE')
 THEN RAISE EXCEPTION 'G8 safety authority or private audit exposed'; END IF;
END $check$;

SET ROLE service_role;
DO $check$
DECLARE order_id uuid; v_incident_id uuid; replay uuid; v_suspension_id uuid;
 v_delivery_id uuid; event_id uuid; blocked boolean; sos_id uuid;
BEGIN
 SELECT id INTO order_id FROM public.mobility_stage_merchant_orders
  WHERE request_key='61000000-0000-4000-8000-000000000001';
 v_incident_id:=public.mobility_stage_safety_report(
  '33333333-3333-4333-8333-333333333333',
  '81000000-0000-4000-8000-000000000001','MERCHANT_ORDER',order_id,
  'QUALITY','MEDIUM');
 replay:=public.mobility_stage_safety_report(
  '33333333-3333-4333-8333-333333333333',
  '81000000-0000-4000-8000-000000000001','MERCHANT_ORDER',order_id,
  'QUALITY','MEDIUM');
 IF v_incident_id<>replay THEN RAISE EXCEPTION 'Incident replay duplicated'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_safety_report(
   '99999999-9999-4999-8999-999999999999',
   '81000000-0000-4000-8000-000000000002','MERCHANT_ORDER',order_id,
   'FRAUD','HIGH');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Outsider reported foreign service'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_safety_report(
   '33333333-3333-4333-8333-333333333333',
   '81000000-0000-4000-8000-000000000003','MERCHANT_ORDER',order_id,
   'SOS','CRITICAL');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'SOS opened for completed commerce order'; END IF;
 event_id:=public.mobility_stage_safety_transition(v_incident_id,
  '22222222-2222-4222-8222-222222222222','triage','IDENTITY_CHECK',
  '82000000-0000-4000-8000-000000000001');
 PERFORM public.mobility_stage_safety_transition(v_incident_id,
  '22222222-2222-4222-8222-222222222222','investigate','EVIDENCE_REVIEW',
  '82000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_safety_transition(v_incident_id,
  '22222222-2222-4222-8222-222222222222','resolve','CUSTOMER_REMEDIATED',
  '82000000-0000-4000-8000-000000000003');
 IF event_id IS NULL OR (SELECT status FROM public.mobility_stage_safety_incidents
  WHERE id=v_incident_id)<>'resolved' OR
  (SELECT count(*) FROM public.mobility_stage_safety_incident_events
   WHERE incident_id=v_incident_id)<>4
 THEN RAISE EXCEPTION 'Incident audit state inconsistent'; END IF;

 v_suspension_id:=public.mobility_stage_suspension_apply(
  '44444444-4444-4444-8444-444444444444','DRIVER',
  '22222222-2222-4222-8222-222222222222','SAFETY_REVIEW',
  '83000000-0000-4000-8000-000000000001');
 IF v_suspension_id<>public.mobility_stage_suspension_apply(
  '44444444-4444-4444-8444-444444444444','DRIVER',
  '22222222-2222-4222-8222-222222222222','SAFETY_REVIEW',
  '83000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Suspension replay duplicated'; END IF;
 v_delivery_id:=public.mobility_stage_delivery_request(
  '88888888-8888-4888-8888-888888888888',
  '84000000-0000-4000-8000-000000000001','AUTO','PARCEL',
  1000,20,20,20,'SAFE_PICKUP','SAFE_DROPOFF',false);
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_accept(v_delivery_id,
   '44444444-4444-4444-8444-444444444444',
   '77777777-7777-4777-8777-777777777777',
   '84000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Suspended driver accepted delivery'; END IF;
 PERFORM public.mobility_stage_suspension_lift(v_suspension_id,
  '22222222-2222-4222-8222-222222222222','REVIEW_CLEARED',
  '83000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_delivery_accept(v_delivery_id,
  '44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  '84000000-0000-4000-8000-000000000003');
 sos_id:=public.mobility_stage_safety_report(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000004','DELIVERY',v_delivery_id,
  'SOS','CRITICAL');
 IF sos_id IS NULL OR
  (SELECT severity FROM public.mobility_stage_safety_incidents WHERE id=sos_id)<>'CRITICAL'
 THEN RAISE EXCEPTION 'Active delivery SOS was not recorded as critical'; END IF;
 IF (SELECT courier_id FROM public.mobility_stage_deliveries WHERE id=v_delivery_id)
  <>'44444444-4444-4444-8444-444444444444'
 OR (SELECT count(*) FROM public.mobility_stage_suspension_events
  WHERE suspension_id=v_suspension_id)<>2
 THEN RAISE EXCEPTION 'Lifted suspension or append-only audit inconsistent'; END IF;
END $check$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$ DECLARE n integer; blocked boolean:=false; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_safety_incidents;
 IF n<>1 THEN RAISE EXCEPTION 'Reporter cannot read own incident'; END IF;
 BEGIN UPDATE public.mobility_stage_safety_incidents SET status='dismissed';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Reporter mutated safety state'; END IF;
END $check$;
SET request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
DO $check$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_safety_incidents;
 IF n<>0 THEN RAISE EXCEPTION 'Outsider can read incident'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G8 participant incidents, active-service SOS gate, admin workflow, suspension enforcement and append-only audit.
