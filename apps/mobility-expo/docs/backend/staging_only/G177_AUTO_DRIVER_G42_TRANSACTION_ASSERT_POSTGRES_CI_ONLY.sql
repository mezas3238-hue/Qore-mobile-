-- G177 original G3 route cannot assert progress when a verified G42
-- session is absent. Check any existing original G3 row when available;
-- never invent an accepted trip or legal approval. Disposable PG16 ONLY.
DO $guard$
DECLARE assigned_trip uuid; driver uuid; prior_status text; count_before bigint;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g177_driver_auto_step_qa(uuid,uuid,bigint,uuid,text,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G177 original SQL extension unavailable'; END IF;
 IF pg_catalog.has_function_privilege('authenticated',
  'public.mobility_stage_g177_driver_auto_step_qa(uuid,uuid,bigint,uuid,text,uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon',
  'public.mobility_stage_g177_driver_auto_step_qa(uuid,uuid,bigint,uuid,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G177 Browser may execute original Driver state mutation'; END IF;
 -- The G109 pre-G38 synthetic accepted fixture is intentionally
 -- transaction-local and does not persist beyond its earlier CI test.
 -- Use the original G3 source if any other test persisted it; otherwise
 -- use an unassigned UUID solely to prove the fail-closed G42 boundary.
 SELECT id,COALESCE(driver_id,passenger_id),status::text
 INTO assigned_trip,driver,prior_status
 FROM public.mobility_stage_auto_demo_trips
 ORDER BY (driver_id IS NOT NULL) DESC,id LIMIT 1;
 IF assigned_trip IS NULL THEN
  assigned_trip:='17700000-0000-4177-8177-000000000002'::uuid;
  driver:='17700000-0000-4177-8177-000000000003'::uuid;
 END IF;
 SELECT count(*) INTO count_before FROM public.mobility_stage_auto_demo_events
 WHERE trip_id=assigned_trip;
 BEGIN
  PERFORM public.mobility_stage_g177_driver_auto_step_qa(
   driver,'17700000-0000-4177-8177-000000000001'::uuid,
   (pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000)::bigint,
   assigned_trip,'arrive',
   '17700000-0000-4177-8177-000000000099'::uuid);
  RAISE EXCEPTION 'G177 improperly advanced a Driver without G42 session';
 EXCEPTION WHEN SQLSTATE 'P1771' THEN NULL;
 END;
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_events
  WHERE trip_id=assigned_trip)<>count_before
 OR (prior_status IS NOT NULL AND (SELECT status::text
  FROM public.mobility_stage_auto_demo_trips
  WHERE id=assigned_trip) IS DISTINCT FROM prior_status)
 THEN RAISE EXCEPTION 'G177 changed original trip without revocable session'; END IF;
 RAISE NOTICE 'G177 original G3 state unchanged without revocable G42 grant';
END $guard$;
