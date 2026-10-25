-- G75 SQL source-backed F1 admin witness: no fixture response projections.
DO $g$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_g72_auto_prequotes','SELECT')
 THEN RAISE EXCEPTION 'G75 browser Admin ledger leak or wrong QA guard'; END IF;
END $g$;
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('75750000-0000-4757-8757-000000000001'),
 ('75750000-0000-4757-8757-000000000002'),
 ('75750000-0000-4757-8757-000000000003'),
 ('75750000-0000-4757-8757-000000000004');
-- Privileged disposable provisioning: remove signup Passenger defaults
-- ONLY for synthetic backoffice principals, never for a real user.
DELETE FROM public.user_roles WHERE user_id IN (
 '75750000-0000-4757-8757-000000000002'::uuid,
 '75750000-0000-4757-8757-000000000003'::uuid,
 '75750000-0000-4757-8757-000000000004'::uuid);
INSERT INTO public.mobility_stage_backoffice_roles(
 user_id,role,status,approved_by) VALUES
 ('75750000-0000-4757-8757-000000000002','admin','active',
  '75750000-0000-4757-8757-000000000004'),
 ('75750000-0000-4757-8757-000000000003','owner','active',
  '75750000-0000-4757-8757-000000000004');
SET LOCAL ROLE service_role;
DO $f1$
DECLARE
 passenger_id uuid:='75750000-0000-4757-8757-000000000001';
 admin_id uuid:='75750000-0000-4757-8757-000000000002';
 owner_id uuid:='75750000-0000-4757-8757-000000000003';
 route_key uuid:='75750000-0000-4757-8757-000000000010';
 quote_key uuid:='75750000-0000-4757-8757-000000000011';
 book_key uuid:='75750000-0000-4757-8757-000000000012';
 route_id uuid; quote_id uuid; trip_id uuid; dto jsonb; denied boolean:=false;
BEGIN
 route_id:=public.mobility_stage_g73_route(passenger_id,route_key,
  'economico','CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 quote_id:=public.mobility_stage_g73_quote(passenger_id,route_id,quote_key);
 trip_id:=public.mobility_stage_g73_book(passenger_id,quote_id,book_key);
 dto:=public.mobility_stage_g75_admin_f1_receipt(admin_id,trip_id);
 IF dto IS NULL OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(dto))<>19
 OR dto->>'viewerId'<>admin_id::text OR dto->>'tripId'<>trip_id::text
 OR dto->>'routeId'<>route_id::text OR dto->>'quoteId'<>quote_id::text
 OR dto->>'passengerId'<>passenger_id::text
 OR dto->>'bookingRequestKey'<>book_key::text
 OR dto->>'status'<>'searching' OR (dto->>'revision')::bigint<>1
 OR dto->>'currency'<>'PYG' OR dto->>'amountGs'<>'15200'
 OR dto->>'assignmentPersisted'<>'false' OR dto->>'driverId' IS NOT NULL
 OR dto->>'commercialEnabled'<>'false' OR dto->>'serverPersisted'<>'true'
 OR (dto->>'observedAt')::bigint>floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint
 OR (dto->>'expiresAt')::bigint-(dto->>'observedAt')::bigint<>30000
 THEN RAISE EXCEPTION 'G75 exact B Admin 19-field witness mismatch %',dto; END IF;
 IF public.mobility_stage_g75_admin_f1_receipt(owner_id,trip_id) IS NOT NULL
 OR public.mobility_stage_g75_admin_f1_receipt(passenger_id,trip_id) IS NOT NULL
 OR public.mobility_stage_g75_admin_f1_receipt(admin_id,
  '99999999-9999-4999-8999-999999999999'::uuid) IS NOT NULL
 THEN RAISE EXCEPTION 'G75 Owner/Passenger/unknown trip leaked to Admin'; END IF;
 RAISE NOTICE 'G75 PASS: B exact 19-field F1 Admin proof from persisted G73+G3+fare';
END $f1$;
RESET ROLE;
-- A revoked backoffice Admin MUST lose access on the same persisted row.
UPDATE public.mobility_stage_backoffice_roles SET
 status='suspended',revision=revision+1
 WHERE user_id='75750000-0000-4757-8757-000000000002'::uuid;
SET LOCAL ROLE service_role;
DO $revoked$
DECLARE t uuid;
BEGIN
 SELECT id INTO t FROM public.mobility_stage_auto_demo_trips
 WHERE passenger_id='75750000-0000-4757-8757-000000000001'::uuid;
 IF public.mobility_stage_g75_admin_f1_receipt(
  '75750000-0000-4757-8757-000000000002'::uuid,t) IS NOT NULL
 THEN RAISE EXCEPTION 'G75 suspended Admin still sees same F1 trip'; END IF;
 RAISE NOTICE 'G75 PASS: suspension revokes F1 Admin read immediately';
END $revoked$;
RESET ROLE;
ROLLBACK; -- QA synthetic Admin identities never survive the assertion.
