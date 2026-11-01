-- G282 executable SQL assertions: disposable PostgreSQL only.
DO $acl$
BEGIN
 IF NOT has_function_privilege('service_role',
 'public.mobility_stage_g282_submit_vehicle_pending_qa(uuid,uuid,bigint,uuid,text,text,text,text,text,text,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
 'public.mobility_stage_g282_submit_vehicle_pending_qa(uuid,uuid,bigint,uuid,text,text,text,text,text,text,integer,integer)','EXECUTE')
 OR has_function_privilege('anon',
 'qore_stage_internal.mobility_stage_g282_submit_vehicle_pending_qa(uuid,uuid,bigint,uuid,text,text,text,text,text,text,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G282 exposed sensitive draft RPC'; END IF;
END $acl$;
SET ROLE service_role;
DO $negative$
DECLARE x uuid;blocked boolean;
BEGIN
 blocked:=false;
 BEGIN
 x:=public.mobility_stage_g282_submit_vehicle_pending_qa(
 '00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000299',1793400000000,
 '00000000-0000-4000-8000-000000000401',
 'AUTO','economico','ASUNCION','QAONLY123','CI','Contract',2024,4);
 EXCEPTION WHEN SQLSTATE 'P2822' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G282 invalid session accepted'; END IF;
 blocked:=false;
 BEGIN
 x:=public.mobility_stage_g282_submit_vehicle_pending_qa(
 '00000000-0000-4000-8000-000000000102',
 '00000000-0000-4000-8000-000000000202',1793400000000,
 '00000000-0000-4000-8000-000000000402',
 'AUTO','economico','ASUNCION','QAONLY124','CI','Contract',2024,4);
 EXCEPTION WHEN SQLSTATE 'P2823' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G282 passenger wrote Driver vehicle application'; END IF;
END $negative$;
RESET ROLE;
DO $no_writes$
BEGIN
 IF (SELECT count(*) FROM public.mobility_vehicle_applications)<>0
 THEN RAISE EXCEPTION 'G282 negatives caused writes'; END IF;
END $no_writes$;
SET ROLE service_role;
DO $positive$
DECLARE a uuid; b uuid; denied boolean;
BEGIN
 a:=public.mobility_stage_g282_submit_vehicle_pending_qa(
 '00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',1793400000000,
 '00000000-0000-4000-8000-000000000403',
 'AUTO','economico','ASUNCION','QAONLY123','CI','Contract',2024,4);
 b:=public.mobility_stage_g282_submit_vehicle_pending_qa(
 '00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',1793400000000,
 '00000000-0000-4000-8000-000000000403',
 'AUTO','economico','ASUNCION','QAONLY123','CI','Contract',2024,4);
 IF a IS NULL OR b<>a THEN RAISE EXCEPTION 'G282 idempotency failed'; END IF;
 denied:=false;
 BEGIN
 PERFORM public.mobility_stage_g282_submit_vehicle_pending_qa(
 '00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',1793400000000,
 '00000000-0000-4000-8000-000000000403',
 'MOTO','moto_pasajero','ASUNCION','QAONLY123','CI','Contract',2024,1);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G282 cross-kind duplicate accepted'; END IF;
END $positive$;
RESET ROLE;
DO $receipt$
BEGIN
 IF (SELECT count(*) FROM public.mobility_vehicle_applications)<>1 OR
    (SELECT count(*) FROM public.mobility_vehicle_applications
      WHERE status='pending' AND evidence_unverified=true)<>1
 THEN RAISE EXCEPTION 'G282 forged approval or duplicate'; END IF;
 UPDATE public.ci_g282_sessions SET is_active=false WHERE
 user_id='00000000-0000-4000-8000-000000000101';
END $receipt$;
SET ROLE service_role;
DO $revoked$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
 PERFORM public.mobility_stage_g282_submit_vehicle_pending_qa(
 '00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',1793400000000,
 '00000000-0000-4000-8000-000000000404',
 'AUTO','economico','ASUNCION','QAONLY125','CI','Contract',2024,4);
 EXCEPTION WHEN SQLSTATE 'P2822' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G282 revoked provider session still admitted'; END IF;
 RAISE NOTICE 'G282 passed: G42 lock, exclusive Driver, pending-only, replay, revoked session';
END $revoked$;
RESET ROLE;
DO $final$
BEGIN
 IF (SELECT count(*) FROM public.mobility_vehicle_applications)<>1
 THEN RAISE EXCEPTION 'G282 revoked write had side effects'; END IF;
END $final$;
