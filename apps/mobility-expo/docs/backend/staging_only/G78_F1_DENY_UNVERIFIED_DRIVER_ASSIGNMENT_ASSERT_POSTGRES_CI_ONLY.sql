-- G78: end-to-end persistence NEGATIVE gate on SAME G73 Passenger ride,
-- G71 Driver KYC and G75 Admin receipt. PG16 disposable; no LIVE or payments.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G78 wrong DB or missing F1 chain'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g31_zone_coverage WHERE eligible_by_policy IS TRUE)
 THEN RAISE EXCEPTION 'G78 QA environment unexpectedly has LIVE legal zone'; END IF;
END $guard$;
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('78780000-0000-4787-8787-000000000001'),
 ('78780000-0000-4787-8787-000000000002'),
 ('78780000-0000-4787-8787-000000000003'),
 ('78780000-0000-4787-8787-000000000004');
DELETE FROM public.user_roles WHERE user_id IN (
 '78780000-0000-4787-8787-000000000002'::uuid,
 '78780000-0000-4787-8787-000000000003'::uuid,
 '78780000-0000-4787-8787-000000000004'::uuid);
INSERT INTO public.user_roles(user_id,role)
 VALUES('78780000-0000-4787-8787-000000000002','driver');
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('78780000-0000-4787-8787-000000000003','admin','active',
 '78780000-0000-4787-8787-000000000004');
SET LOCAL ROLE service_role;
DO $qa$
DECLARE
 passenger uuid:='78780000-0000-4787-8787-000000000001';
 driver uuid:='78780000-0000-4787-8787-000000000002';
 administrator uuid:='78780000-0000-4787-8787-000000000003';
 vehicle uuid:='78780000-0000-4787-8787-000000000005';
 route_key uuid:='78780000-0000-4787-8787-000000000010';
 quote_key uuid:='78780000-0000-4787-8787-000000000011';
 book_key uuid:='78780000-0000-4787-8787-000000000012';
 v_route uuid;v_quote uuid;v_trip uuid; receipt jsonb; blocked boolean;
BEGIN
 v_route:=public.mobility_stage_g73_route(passenger,route_key,'economico',
 'CENTRO_FIXTURE','AIRPORT_FIXTURE','ASUNCION_FIXTURE',5000,600,0);
 v_quote:=public.mobility_stage_g73_quote(passenger,v_route,quote_key);
 v_trip:=public.mobility_stage_g73_book(passenger,v_quote,book_key);
 receipt:=public.mobility_stage_g75_admin_f1_receipt(administrator,v_trip);
 IF receipt->>'tripId'<>v_trip::text OR receipt->>'routeId'<>v_route::text
 OR receipt->>'quoteId'<>v_quote::text OR receipt->>'status'<>'searching'
 OR receipt->>'driverId' IS NOT NULL OR receipt->>'assignmentPersisted'<>'false'
 THEN RAISE EXCEPTION 'G78 initial shared Client/Admin trip drift'; END IF;
 IF public.mobility_stage_g71_valid_locked_dossier(driver,vehicle)
 THEN RAISE EXCEPTION 'G78 Driver without 8 verified documents accepted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_offer(v_trip,driver,vehicle,
   '78780000-0000-4787-8787-000000000013'::uuid,15);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G78 unverified Driver obtained offer'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_offers
  WHERE trip_id=v_trip AND driver_id=driver)
 THEN RAISE EXCEPTION 'G78 denied offer was persisted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   '78780000-0000-4787-8787-000000000014'::uuid,driver,
   '78780000-0000-4787-8787-000000000015'::uuid);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G78 nonexistent offer was accepted'; END IF;
 receipt:=public.mobility_stage_g75_admin_f1_receipt(administrator,v_trip);
 IF receipt->>'status'<>'searching' OR receipt->>'driverId' IS NOT NULL
 OR receipt->>'assignmentPersisted'<>'false'
 OR (receipt->>'revision')::integer<>1
 OR public.mobility_stage_g73_book(passenger,v_quote,book_key)<>v_trip
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_trips
  WHERE passenger_id=passenger AND request_key=book_key)<>1
 THEN RAISE EXCEPTION 'G78 denied Driver changed or duplicated F1 booking'; END IF;
 RAISE NOTICE 'G78 PASS: one G73 Client ride / G75 Admin witness, no forged Driver';
END $qa$;
RESET ROLE;
ROLLBACK;
