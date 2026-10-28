-- G130 disposable proof: exact credits, replay, bad scope, exhaustion.
DO $gate$ BEGIN
 IF current_database()<>'qore_disposable_geoapify'
 OR current_setting('application_name')<>'qore_ci_disposable_geoapify'
 OR to_regprocedure('public.mobility_stage_g130_reserve_geoapify_free_qa(uuid,uuid,text,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G130 tests only in disposable PG16'; END IF;
 IF pg_catalog.has_function_privilege('anon',
  'public.mobility_stage_g130_reserve_geoapify_free_qa(uuid,uuid,text,uuid,uuid)',
  'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',
  'public.mobility_stage_g130_reserve_geoapify_free_qa(uuid,uuid,text,uuid,uuid)',
  'EXECUTE') OR NOT pg_catalog.has_function_privilege('service_role',
  'public.mobility_stage_g130_reserve_geoapify_free_qa(uuid,uuid,text,uuid,uuid)',
  'EXECUTE')
 THEN RAISE EXCEPTION 'G130 bad role privileges'; END IF;
END $gate$;
DO $test$
DECLARE a uuid:='13000000-0000-4130-8130-000000000001';
 d uuid:='13000000-0000-4130-8130-000000000002';
 evidence uuid; receipt jsonb; original jsonb; i integer; counter integer;
BEGIN
 FOR i IN 1..100 LOOP
  evidence:=('13000000-0000-4130-8130-'||
   pg_catalog.lpad(i::text,12,'0'))::uuid;
  receipt:=public.mobility_stage_g130_reserve_geoapify_free_qa(
   a,d,CASE WHEN i%2=0 THEN 'AUTO' ELSE 'MOTO' END,evidence,evidence);
  IF receipt->>'approved'<>'true' OR receipt->>'durable'<>'true'
  OR receipt->>'reservedCredits'<>'3'
  THEN RAISE EXCEPTION 'G130 failed distinct reservation at %',i; END IF;
  IF i=1 THEN original:=receipt; END IF;
 END LOOP;
 SELECT calls INTO counter FROM public.mobility_stage_g130_free_quota_days
 WHERE quota_day=(pg_catalog.clock_timestamp() AT TIME ZONE 'UTC')::date;
 IF counter<>100 OR (SELECT count(*) FROM public.mobility_stage_g130_free_route_reservations)<>100
 THEN RAISE EXCEPTION 'G130 free quota count wrong'; END IF;
 evidence:='13000000-0000-4130-8130-000000000001'::uuid;
 receipt:=public.mobility_stage_g130_reserve_geoapify_free_qa(a,d,'MOTO',evidence,evidence);
 IF receipt->>'approved'<>'false' OR receipt->>'replayBlocked'<>'true'
 OR receipt->>'reservationId'<>original->>'reservationId'
 THEN RAISE EXCEPTION 'G130 idempotency must never authorize second provider request'; END IF;
 evidence:='13000000-0000-4130-8130-000000000101'::uuid;
 receipt:=public.mobility_stage_g130_reserve_geoapify_free_qa(a,d,'AUTO',evidence,evidence);
 IF receipt->>'approved'<>'false'
 OR receipt->>'reason'<>'FREE_DAILY_BUDGET_EXHAUSTED'
 THEN RAISE EXCEPTION 'G130 quota overflow must fail closed'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g130_free_route_reservations)<>100
 OR (SELECT credits FROM public.mobility_stage_g130_free_quota_days
   WHERE quota_day=(pg_catalog.clock_timestamp() AT TIME ZONE 'UTC')::date)<>300
 THEN RAISE EXCEPTION 'G130 replay/over-limit unexpectedly spent credits'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g130_reserve_geoapify_free_qa(
   a,d,'AUTO','13000000-0000-4130-8130-000000000001'::uuid,
   '13000000-0000-4130-8130-000000000001'::uuid);
  RAISE EXCEPTION 'Expected contradictory AUTO replay rejection';
 EXCEPTION WHEN SQLSTATE 'P1301' THEN NULL;
 END;
 BEGIN
  PERFORM public.mobility_stage_g130_reserve_geoapify_free_qa(
   a,d,'MOTO','13000000-0000-4130-8130-000000000002'::uuid,
   '13000000-0000-4130-8130-000000000003'::uuid);
  RAISE EXCEPTION 'Expected requestKey/evidence mismatch rejection';
 EXCEPTION WHEN SQLSTATE 'P1301' THEN NULL;
 END;
 RAISE NOTICE 'G130 PASS: 100 calls, 300 credits, replay denied, scope fenced';
END $test$;
