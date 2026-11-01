-- G263 disposable PG17 assertions: all four services and fail-closed auth.
DO $acl$ DECLARE r oid;s oid;
BEGIN
 r:=to_regprocedure('public.mobility_stage_g197_read_pickup_qa(uuid,uuid,bigint)');
 s:=to_regprocedure('public.mobility_stage_g197_save_pickup_qa(uuid,uuid,bigint,text,integer,bigint)');
 IF r IS NULL OR s IS NULL
  OR (SELECT count(*) FROM pg_proc WHERE oid IN (r,s) AND prosecdef)=2
  OR has_function_privilege('anon',r,'EXECUTE')
  OR has_function_privilege('authenticated',r,'EXECUTE')
  OR has_function_privilege('anon',s,'EXECUTE')
  OR has_function_privilege('authenticated',s,'EXECUTE')
  OR NOT has_function_privilege('service_role',r,'EXECUTE')
  OR NOT has_function_privilege('service_role',s,'EXECUTE')
  OR has_table_privilege('service_role','public.mobility_stage_g263_pickup_preferences','SELECT')
  OR has_table_privilege('service_role','public.mobility_stage_g263_pickup_preferences','UPDATE')
  OR has_table_privilege('service_role','public.mobility_stage_g263_pickup_preferences','INSERT')
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.mobility_stage_g263_pickup_preferences'::regclass)
 THEN RAISE EXCEPTION 'G263 ACL/RLS violation'; END IF;
END $acl$;
INSERT INTO auth.users(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO auth.sessions(id,user_id) VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','driver'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','driver'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','passenger');
SET ROLE service_role;
DO $assert$ DECLARE
 a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 c uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 s uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 t uuid:='ffffffff-ffff-4fff-8fff-ffffffffffff';
 bad uuid:='00000000-0000-4000-8000-000000000000';
 v jsonb; q jsonb; k text; pos integer:=0;
BEGIN
 v:=public.mobility_stage_g197_read_pickup_qa(a,s,12345);
 IF v->>'driverId'<>a::text OR v->>'mode'<>'STAGING_DEMO_ONLY'
 OR v->>'productionEnabled'<>'false' OR v->>'liveEnabled'<>'false'
 OR jsonb_array_length(v->'preferences')<>0
 THEN RAISE EXCEPTION 'G263 initial private read invalid'; END IF;
 FOREACH k IN ARRAY ARRAY['RIDE','MOTO_RIDE','DELIVERY','MERCHANT_ORDER'] LOOP
  pos:=pos+1;
  q:=public.mobility_stage_g197_save_pickup_qa(a,s,12345,k,
   CASE WHEN k='MOTO_RIDE' THEN 0 WHEN k='MERCHANT_ORDER' THEN 5000 ELSE pos*1000 END,0);
  IF q->>'driverId'<>a::text OR q->>'serviceKind'<>k
  OR q->>'revision'<>'1' OR q->>'serverPersisted'<>'true'
  THEN RAISE EXCEPTION 'G263 first revision not persisted %',k; END IF;
 END LOOP;
 v:=public.mobility_stage_g197_read_pickup_qa(a,s,12345);
 IF jsonb_array_length(v->'preferences')<>4
 OR jsonb_array_length(public.mobility_stage_g197_read_pickup_qa(b,t,12345)->'preferences')<>0
 THEN RAISE EXCEPTION 'G263 cross-driver exposure'; END IF;
 q:=public.mobility_stage_g197_save_pickup_qa(a,s,12345,'RIDE',5000,1);
 IF q->>'revision'<>'2' OR q->>'maximumRoadMeters'<>'5000'
 THEN RAISE EXCEPTION 'G263 update not persisted'; END IF;
END $assert$;
RESET ROLE;
-- Direct role assignment to passenger or overlapping Driver/Admin invalidates.
INSERT INTO public.user_roles(user_id,role)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin');
SET ROLE service_role;
DO $negative$ DECLARE
 a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 c uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 s uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 t uuid:='ffffffff-ffff-4fff-8fff-ffffffffffff';
 bad uuid:='00000000-0000-4000-8000-000000000000';
 denied boolean;
BEGIN
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g197_read_pickup_qa(a,s,12345);
 EXCEPTION WHEN SQLSTATE 'P6302' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G263 dual-role read allowed'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g197_save_pickup_qa(a,s,12345,'RIDE',1000,2);
 EXCEPTION WHEN SQLSTATE 'P6302' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G263 dual-role write allowed'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g197_read_pickup_qa(b,s,12345);
 EXCEPTION WHEN SQLSTATE 'P6301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G263 session/user mismatch allowed'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g197_save_pickup_qa(b,t,12345,'RIDE',555,0);
 EXCEPTION WHEN SQLSTATE 'P6303' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G263 arbitrary distance allowed'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g197_save_pickup_qa(b,t,12345,'DELIVERY',2000,2);
 EXCEPTION WHEN SQLSTATE 'P6304' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G263 stale first revision allowed'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g197_read_pickup_qa(c,bad,12345);
 EXCEPTION WHEN SQLSTATE 'P6301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G263 unknown session allowed'; END IF;
END $negative$;
RESET ROLE;
DELETE FROM auth.sessions
 WHERE id='ffffffff-ffff-4fff-8fff-ffffffffffff';
SET ROLE service_role;
DO $revoked$ DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.mobility_stage_g197_save_pickup_qa(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ffffffff-ffff-4fff-8fff-ffffffffffff',12345,'DELIVERY',0,0);
 EXCEPTION WHEN SQLSTATE 'P6301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G263 revoked session allowed'; END IF;
END $revoked$;
RESET ROLE;
SELECT 'G263_PG17_PRIVATE_PICKUP_PREFERENCES_PASS' AS result;
