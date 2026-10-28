-- G37 adversarial assertions: real service_role grants, legitimate RPC and owner tamper.
-- PostgreSQL 16 disposable chain ONLY; all synthetic data rolled back.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g37_state_integrity()') IS NULL
 THEN RAISE EXCEPTION 'G37 assertion refuses real infrastructure'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $permissions$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'public.mobility_stage_auto_demo_trips',
  'public.mobility_stage_deliveries',
  'public.mobility_stage_auto_demo_events',
  'public.mobility_stage_delivery_events'
 ] LOOP
  IF has_table_privilege('service_role',t,'INSERT')
     OR has_table_privilege('service_role',t,'UPDATE')
     OR has_table_privilege('service_role',t,'DELETE')
     OR has_table_privilege('authenticated',t,'INSERT')
     OR has_table_privilege('anon',t,'UPDATE')
  THEN RAISE EXCEPTION 'G37 forbidden direct DML remains on %',t; END IF;
 END LOOP;
 IF has_function_privilege('anon',
  'public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)','EXECUTE')
  OR has_function_privilege('authenticated',
  'public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)','EXECUTE')
  OR has_function_privilege('service_role',
  'public.mobility_stage_delivery_accept(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G37 wrong RPC EXECUTE grants'; END IF;
END $permissions$;

INSERT INTO auth.users(id) VALUES
 ('37370000-0000-4737-8737-000000000001')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('37370000-0000-4737-8737-000000000001','passenger')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE service_role;
DO $role$
DECLARE trip uuid; delivery uuid; denied boolean;
BEGIN
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_auto_demo_trips
   SET origin_tag='TAMPERED'
   WHERE request_key='00000000-0000-4000-8000-000000000243';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G37 service_role direct AUTO UPDATE granted'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.mobility_stage_deliveries DEFAULT VALUES;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G37 service_role direct cargo INSERT granted'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.mobility_stage_auto_demo_events DEFAULT VALUES;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G37 service_role direct event INSERT granted'; END IF;
 trip:=public.mobility_stage_auto_demo_request(
   '37370000-0000-4737-8737-000000000001',
   '37370000-0000-4737-8737-000000000002',
   'CENTRO','LAMBRARE','economico');
 IF trip IS NULL THEN RAISE EXCEPTION 'G37 lawful AUTO request denied'; END IF;
 PERFORM public.mobility_stage_auto_demo_transition(
  trip,'37370000-0000-4737-8737-000000000001',
  'cancelled','37370000-0000-4737-8737-000000000003');
 delivery:=public.mobility_stage_delivery_request(
   '37370000-0000-4737-8737-000000000001',
   '37370000-0000-4737-8737-000000000004',
   'MOTO','DOCUMENTS',50,5,5,5,'CENTRO','LAMBRARE',false);
 IF delivery IS NULL THEN RAISE EXCEPTION 'G37 lawful cargo request denied'; END IF;
 PERFORM public.mobility_stage_delivery_transition(
   delivery,'37370000-0000-4737-8737-000000000001','cancel',
   '37370000-0000-4737-8737-000000000005');
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_events e
    WHERE e.trip_id=trip AND e.next_status='cancelled')
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_delivery_events e
    WHERE e.delivery_id=delivery AND e.next_status='cancelled')
 THEN RAISE EXCEPTION 'G37 authorized transition/event path broke'; END IF;
END $role$;
RESET ROLE;

DO $tamper$
DECLARE trip uuid; delivery uuid; denied boolean;
BEGIN
 SELECT id INTO trip FROM public.mobility_stage_auto_demo_trips
  WHERE request_key='37370000-0000-4737-8737-000000000002';
 SELECT id INTO delivery FROM public.mobility_stage_deliveries
  WHERE request_key='37370000-0000-4737-8737-000000000004';
 IF trip IS NULL OR delivery IS NULL THEN RAISE EXCEPTION 'G37 fixture missing'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_auto_demo_trips SET origin_tag='ALTERED'
  WHERE id=trip;
 EXCEPTION WHEN SQLSTATE 'G3701' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G37 AUTO origin modified after creation'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_auto_demo_trips
   SET status='completed',revision=revision+1 WHERE id=trip;
 EXCEPTION WHEN SQLSTATE 'G3701' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G37 resurrected terminal AUTO job'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_deliveries
   SET pickup_tag='ALTERED' WHERE id=delivery;
 EXCEPTION WHEN SQLSTATE 'G3701' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G37 cargo route modified after creation'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_deliveries
   SET status='delivered',revision=revision+1 WHERE id=delivery;
 EXCEPTION WHEN SQLSTATE 'G3701' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G37 resurrected terminal cargo job'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots s
   WHERE s.assignment_id IN(trip,delivery))
 THEN RAISE EXCEPTION 'G37 unexpected active driver slot'; END IF;
 RAISE NOTICE 'G37 PASS: privileged DML removed, private server RPC valid, identity/state tamper denied';
END $tamper$;
ROLLBACK;
