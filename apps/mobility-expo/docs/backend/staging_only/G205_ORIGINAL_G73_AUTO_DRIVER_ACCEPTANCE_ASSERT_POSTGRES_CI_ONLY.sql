-- G205 SQL security regression on the SAME disposable PostgreSQL G73/G71
-- installation. No fake accepted Driver, independent IdP, GPS or legal permit.
DO $assert$ DECLARE
 fn text:='public.mobility_stage_g205_accept_original_auto_qa(uuid,uuid,bigint,uuid,uuid)';
 denied boolean:=false;
 before_events bigint;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure(fn) IS NULL
 THEN RAISE EXCEPTION 'G205 missing original Driver/Passenger acceptance procedure'; END IF;
 IF pg_catalog.has_function_privilege('anon',fn,'EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',fn,'EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role',fn,'EXECUTE')
 THEN RAISE EXCEPTION 'G205 Driver SQL accessible to mobile SDK'; END IF;
 SELECT count(*) INTO before_events FROM public.mobility_stage_auto_demo_events;
 BEGIN
  PERFORM public.mobility_stage_g205_accept_original_auto_qa(
   '20500000-0000-4205-8205-000000000001'::uuid,
   '20500000-0000-4205-8205-000000000002'::uuid,
   (pg_catalog.extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint,
   '20500000-0000-4205-8205-000000000003'::uuid,
   '20500000-0000-4205-8205-000000000004'::uuid);
 EXCEPTION WHEN SQLSTATE 'P2051' THEN denied:=true; END;
 IF NOT denied OR (SELECT count(*) FROM public.mobility_stage_auto_demo_events)<>before_events
 THEN RAISE EXCEPTION 'G205 forged Driver accepted or wrote an event'; END IF;
 RAISE NOTICE 'G205 PASS: original G73-only Driver acceptance is SQL private, forged identity denied, no event written; external proof NOT certified';
END $assert$;
