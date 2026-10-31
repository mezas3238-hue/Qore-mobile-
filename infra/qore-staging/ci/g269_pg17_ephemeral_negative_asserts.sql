-- G269 provider-level negative assertions, only inside BEGIN ... DDL ... ROLLBACK
-- on Supabase STAGING. Read-only validation of ownership and ACL after
-- temporary function definitions. No synthetic auth.users, no trips or DML.
DO $a$
DECLARE
 fake uuid:='00000000-0000-4000-8000-000000000997';
 denied boolean;
BEGIN
 IF to_regclass('public.mobility_stage_g269_auto_dispatch_jobs') IS NULL OR
  to_regclass('public.mobility_stage_g269_pickup_road_proofs') IS NULL
 THEN RAISE EXCEPTION 'G269 ephemeral schema absent'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class
  WHERE oid='public.mobility_stage_g269_auto_dispatch_jobs'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class
  WHERE oid='public.mobility_stage_g269_pickup_road_proofs'::regclass)
 THEN RAISE EXCEPTION 'G269 private queue RLS missing'; END IF;
 IF has_table_privilege('authenticated',
  'public.mobility_stage_g269_auto_dispatch_jobs','SELECT') OR
 has_table_privilege('anon',
  'public.mobility_stage_g269_pickup_road_proofs','INSERT') OR
 has_table_privilege('service_role',
  'public.mobility_stage_g269_pickup_road_proofs','INSERT')
 THEN RAISE EXCEPTION 'G269 direct queue/proof table privilege leak'; END IF;
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_g112_run_booked_auto_dispatch_qa(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g112_run_booked_auto_dispatch_qa(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g269_register_pickup_road_proof(uuid,uuid,uuid,uuid,uuid,uuid,text,integer,timestamp with time zone)','EXECUTE')
 THEN RAISE EXCEPTION 'G269 public RPC privilege leak'; END IF;
 IF public.mobility_stage_g90_passenger_dispatch_status_qa(fake,fake) IS NOT NULL
 THEN RAISE EXCEPTION 'G269 missing user can see Passenger queue'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g112_run_booked_auto_dispatch_qa(fake,fake,fake);
 EXCEPTION WHEN SQLSTATE 'P2693' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G269 unowned trip dispatch not blocked'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g269_register_pickup_road_proof(
   fake,fake,fake,fake,fake,fake,'GEOAPIFY',2500,pg_catalog.clock_timestamp());
 EXCEPTION WHEN SQLSTATE 'P2692' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G269 forged booking proof not blocked'; END IF;
 RAISE NOTICE 'G269 negative safeguards verified without modifying real users';
END $a$;
