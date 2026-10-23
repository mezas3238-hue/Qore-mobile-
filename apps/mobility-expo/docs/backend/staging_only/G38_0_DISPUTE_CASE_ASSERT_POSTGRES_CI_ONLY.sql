-- G38.0 transaction replay: accept -> pickup -> deliver -> dispute -> return.
-- Existing G36 two-session harness leaves reverse race DELIVERY winner.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G38 dispute test only disposable PG'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
SET LOCAL ROLE service_role;
DO $finish$
DECLARE d uuid;
BEGIN
 SELECT id INTO d FROM public.mobility_stage_deliveries
  WHERE request_key='b6360000-0000-4636-8636-000000000013'
    AND status='accepted';
 IF d IS NULL THEN RAISE EXCEPTION 'G38 requires G36 reverse cargo winner'; END IF;
 PERFORM public.mobility_stage_delivery_transition(
  d,'00000000-0000-4000-8000-000000000181','pickup',
  'b6380000-0000-4638-8638-000000000001');
 PERFORM public.mobility_stage_delivery_transition(
  d,'00000000-0000-4000-8000-000000000181','deliver',
  'b6380000-0000-4638-8638-000000000002',
  'b6380000-0000-4638-8638-000000000003');
END $finish$;
RESET ROLE;
DO $released$
BEGIN
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots s
  WHERE s.assignment_kind='DELIVERY'
   AND s.assignment_id=(SELECT id FROM public.mobility_stage_deliveries
    WHERE request_key='b6360000-0000-4636-8636-000000000013'))
 THEN RAISE EXCEPTION 'G38 delivered cargo retained physical slot'; END IF;
END $released$;
SET LOCAL ROLE service_role;
DO $case$
DECLARE d uuid; rec1 uuid; rec2 uuid;
BEGIN
 SELECT id INTO d FROM public.mobility_stage_deliveries
  WHERE request_key='b6360000-0000-4636-8636-000000000013';
 rec1:=public.mobility_stage_delivery_transition(
  d,'b6360000-0000-4636-8636-000000000011','dispute',
  'b6380000-0000-4638-8638-000000000004');
 rec2:=public.mobility_stage_delivery_transition(
  d,'b6360000-0000-4636-8636-000000000011','dispute',
  'b6380000-0000-4638-8638-000000000004');
 IF rec1 IS NULL OR rec1<>rec2 THEN
  RAISE EXCEPTION 'G38 dispute idempotence broken'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_deliveries
  WHERE id=d AND status='disputed') THEN
  RAISE EXCEPTION 'G38 valid dispute denied'; END IF;
 PERFORM public.mobility_stage_delivery_transition(
  d,'00000000-0000-4000-8000-000000000181','return',
  'b6380000-0000-4638-8638-000000000005');
END $case$;
RESET ROLE;
DO $final$
DECLARE d uuid;
BEGIN
 SELECT id INTO d FROM public.mobility_stage_deliveries
 WHERE request_key='b6360000-0000-4636-8636-000000000013'
  AND status='returned';
 IF d IS NULL OR EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots
  WHERE assignment_id=d AND assignment_kind='DELIVERY')
 THEN RAISE EXCEPTION 'G38 return did not preserve released slot'; END IF;
 RAISE NOTICE 'G38.0 PASS: delivered/disputed/returned replay preserves case and no reassignment';
END $final$;
ROLLBACK;
