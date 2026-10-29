-- G177 original G3 route cannot assert progress when a verified G42
-- session is absent. Checks real completed pre-G38 CI fixture, never a
-- fabricated new legal dispatch. Disposable PostgreSQL16 ONLY.
DO $guard$
DECLARE assigned_trip uuid; driver uuid; count_before bigint;
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
 SELECT id,driver_id INTO assigned_trip,driver
 FROM public.mobility_stage_auto_demo_trips
 WHERE status='completed' AND driver_id IS NOT NULL
 ORDER BY id LIMIT 1;
 IF assigned_trip IS NULL OR driver IS NULL
 THEN RAISE EXCEPTION 'G177 requires original completed G109 prelegal fixture'; END IF;
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
 OR (SELECT status FROM public.mobility_stage_auto_demo_trips
  WHERE id=assigned_trip)<>'completed'
 THEN RAISE EXCEPTION 'G177 changed original completed trip without revocable session'; END IF;
 RAISE NOTICE 'G177 original pre-G38 completed AUTO remains immutable without G42 grant';
END $guard$;
