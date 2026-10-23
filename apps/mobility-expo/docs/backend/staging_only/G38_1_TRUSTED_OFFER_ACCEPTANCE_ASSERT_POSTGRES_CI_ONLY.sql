-- G38.1 real access-denial and private offer acceptance negative tests.
-- No successful dispatch is allowed in this synthetic CI chain.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g38_trusted_offer_proofs') IS NULL
 THEN RAISE EXCEPTION 'G38.1 QA refuses non-disposable PG'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $grants$
BEGIN
 IF has_table_privilege('service_role',
   'public.mobility_stage_g38_trusted_offer_proofs','SELECT')
 OR has_table_privilege('service_role',
   'public.mobility_stage_g38_trusted_offer_proofs','INSERT')
 OR has_table_privilege('authenticated',
   'public.mobility_stage_g38_trusted_offer_proofs','SELECT')
 OR has_function_privilege('service_role',
   'public.mobility_stage_g38_acceptance_fence()','EXECUTE')
 THEN RAISE EXCEPTION 'G38 trusted attestation can be read/forged by client'; END IF;
END $grants$;
INSERT INTO auth.users(id) VALUES
 ('b6381000-0000-4638-8638-000000000001'),
 ('b6381000-0000-4638-8638-000000000002')
ON CONFLICT DO NOTHING;
SET LOCAL ROLE service_role;
DO $rejection$
DECLARE trip uuid; del uuid; o uuid; denied boolean;
BEGIN
 trip:=public.mobility_stage_auto_demo_request(
  'b6381000-0000-4638-8638-000000000001',
  'b6381000-0000-4638-8638-000000000003',
  'CENTRO','LAMBRARE','economico');
 o:=public.mobility_stage_auto_demo_offer(
  trip,'00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000184',
  'b6381000-0000-4638-8638-000000000004',60);
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   o,'00000000-0000-4000-8000-000000000181',
   'b6381000-0000-4638-8638-000000000005');
 EXCEPTION WHEN SQLSTATE 'G3801' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G38 accepted AUTO without trustworthy attestation'; END IF;
 IF (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>'searching'
 THEN RAISE EXCEPTION 'G38 rejected AUTO left assigned state'; END IF;
 del:=public.mobility_stage_delivery_request(
  'b6381000-0000-4638-8638-000000000002',
  'b6381000-0000-4638-8638-000000000006',
  'AUTO','PARCEL',250,10,10,10,'CENTRO','LAMBRARE',false);
 o:=public.mobility_stage_delivery_offer(
  del,'00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000184',
  'b6381000-0000-4638-8638-000000000007',60);
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_accept_offer(
   o,'00000000-0000-4000-8000-000000000181',
   'b6381000-0000-4638-8638-000000000008');
 EXCEPTION WHEN SQLSTATE 'G3801' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G38 accepted delivery without attestation'; END IF;
 IF (SELECT status FROM public.mobility_stage_deliveries WHERE id=del)<>'requested'
 THEN RAISE EXCEPTION 'G38 rejected cargo left assigned state'; END IF;
 RAISE NOTICE 'G38.1 PASS: server-only proof absent, AUTO and DELIVERY fail closed';
END $rejection$;
RESET ROLE;
ROLLBACK;
