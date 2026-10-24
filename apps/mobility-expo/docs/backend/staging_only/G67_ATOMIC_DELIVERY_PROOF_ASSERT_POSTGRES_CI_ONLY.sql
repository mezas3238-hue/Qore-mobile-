-- G67 security and atomicity tests, entirely rolled back (disposable PG16).
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g67_delivery_proofs') IS NULL
 THEN RAISE EXCEPTION 'G67 ASSERT refuses remote/incomplete DB'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='40s';
DO $tests$
DECLARE
 d1 uuid:='67000000-0000-4670-8670-000000000001';
 d2 uuid:='67000000-0000-4670-8670-000000000002';
 p1 uuid:='67000000-0000-4670-8670-000000000011';
 p2 uuid:='67000000-0000-4670-8670-000000000012';
 sender uuid:='99999999-9999-4999-8999-999999999999';
 courier uuid:='11111111-1111-4111-8111-111111111111';
 vehicle uuid:='66666666-6666-4666-8666-666666666666';
 reviewer uuid:='22222222-2222-4222-8222-222222222222';
 key1 uuid:='67000000-0000-4670-8670-000000000021';
 key2 uuid:='67000000-0000-4670-8670-000000000022';
 event_id uuid;
 failed boolean;
BEGIN
 IF has_table_privilege('service_role','public.mobility_stage_g67_delivery_proofs','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_g67_delivery_proofs','UPDATE')
 OR has_table_privilege('authenticated','public.mobility_stage_g67_delivery_proofs','SELECT')
 OR has_table_privilege('anon','public.mobility_stage_g67_delivery_proof_audit','SELECT')
 OR has_function_privilege('service_role',
  'public.mobility_stage_g67_register_proof_qa(uuid,uuid,uuid,text,text,integer,text,uuid,timestamptz)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g67_revoke_proof_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role',
  'public.mobility_stage_g67_proof_atomic_guard()','EXECUTE')
 THEN RAISE EXCEPTION 'G67 proof privilege leaked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=sender)
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=courier)
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=reviewer)
 THEN RAISE EXCEPTION 'G67 previous G5 user fixtures not available'; END IF;
 -- Owner-only synthetic G37-compliant state transitions, bypassing NO_GO
 -- dispatch on purpose; never called by an API.
 INSERT INTO public.mobility_stage_deliveries
  (id,request_key,sender_id,requested_vehicle_kind,category,grams,
   length_cm,width_cm,height_cm,pickup_tag,delivery_tag)
 VALUES(d1,'67000000-0000-4670-8670-000000000031',sender,'MOTO',
  'PARCEL',500,10,10,10,'CENTRO_G67','LAMBRARE_G67');
 UPDATE public.mobility_stage_deliveries SET courier_id=courier,vehicle_id=vehicle,
  status='accepted',revision=revision+1,changed_at=clock_timestamp() WHERE id=d1;
 UPDATE public.mobility_stage_deliveries SET status='picked_up',
  revision=revision+1,changed_at=clock_timestamp() WHERE id=d1;
 -- Forged/unregistered UUID always fails *inside SQL*.
 failed:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_transition(d1,courier,'deliver',key1,p1);
 EXCEPTION WHEN SQLSTATE 'G6703' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'G67 arbitrary UUID accepted'; END IF;
 failed:=false;
 BEGIN
  PERFORM public.mobility_stage_g67_register_proof_qa(p1,d1,courier,
   'PHOTO',repeat('a',64),1200,'image/jpeg',courier,
   clock_timestamp()+interval '4 minutes');
 EXCEPTION WHEN SQLSTATE 'G6701' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'G67 self-reviewed proof accepted'; END IF;
 PERFORM public.mobility_stage_g67_register_proof_qa(p1,d1,courier,
  'PHOTO',repeat('a',64),1200,'image/jpeg',reviewer,
  clock_timestamp()+interval '4 minutes');
 failed:=false;
 BEGIN
  PERFORM public.mobility_stage_g67_register_proof_qa(p1,d1,courier,
   'PHOTO',repeat('b',64),1200,'image/jpeg',reviewer,
   clock_timestamp()+interval '4 minutes');
 EXCEPTION WHEN unique_violation THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'G67 conflicting duplicate proof accepted'; END IF;
 -- A direct privileged state UPDATE cannot replace a G5 event receipt.
 failed:=false;
 BEGIN
  UPDATE public.mobility_stage_deliveries SET status='delivered',
   proof_ref=p1,revision=revision+1,changed_at=clock_timestamp() WHERE id=d1;
  SET CONSTRAINTS mobility_stage_g67_delivery_event IMMEDIATE;
 EXCEPTION WHEN SQLSTATE 'G6704' THEN failed:=true; END;
 SET CONSTRAINTS mobility_stage_g67_delivery_event DEFERRED;
 IF NOT failed THEN RAISE EXCEPTION 'G67 direct UPDATE forged delivery receipt'; END IF;
 IF (SELECT status FROM public.mobility_stage_g67_delivery_proofs WHERE proof_ref=p1)<>'verified'
 OR (SELECT status FROM public.mobility_stage_deliveries WHERE id=d1)<>'picked_up'
 THEN RAISE EXCEPTION 'G67 rollback did not restore proof and delivery'; END IF;
 event_id:=public.mobility_stage_delivery_transition(d1,courier,'deliver',key1,p1);
 IF event_id IS NULL OR (SELECT status FROM public.mobility_stage_deliveries WHERE id=d1)<>'delivered'
 OR (SELECT status FROM public.mobility_stage_g67_delivery_proofs WHERE proof_ref=p1)<>'consumed'
 OR (SELECT consumed_revision FROM public.mobility_stage_g67_delivery_proofs WHERE proof_ref=p1)<>4
 THEN RAISE EXCEPTION 'G67 valid delivery not consumed atomically'; END IF;
 IF public.mobility_stage_delivery_transition(d1,courier,'deliver',key1,p1)<>event_id
 OR (SELECT count(*) FROM public.mobility_stage_g67_delivery_proof_audit
   WHERE proof_ref=p1 AND event='CONSUME')<>1
 THEN RAISE EXCEPTION 'G67 replay duplicated consumed receipt'; END IF;
 failed:=false;
 BEGIN
  PERFORM public.mobility_stage_g67_revoke_proof_qa(p1,reviewer);
 EXCEPTION WHEN SQLSTATE 'G6702' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'G67 consumed receipt revoked'; END IF;
 INSERT INTO public.mobility_stage_deliveries
  (id,request_key,sender_id,requested_vehicle_kind,category,grams,
   length_cm,width_cm,height_cm,pickup_tag,delivery_tag)
 VALUES(d2,'67000000-0000-4670-8670-000000000032',sender,'MOTO',
  'PARCEL',500,10,10,10,'CENTRO_G67','LAMBRARE_G67');
 UPDATE public.mobility_stage_deliveries SET courier_id=courier,vehicle_id=vehicle,
  status='accepted',revision=revision+1,changed_at=clock_timestamp() WHERE id=d2;
 UPDATE public.mobility_stage_deliveries SET status='picked_up',
  revision=revision+1,changed_at=clock_timestamp() WHERE id=d2;
 PERFORM public.mobility_stage_g67_register_proof_qa(p2,d2,courier,
  'SIGNATURE',repeat('c',64),1200,'image/png',reviewer,
  clock_timestamp()+interval '4 minutes');
 -- Cross-delivery proof must fail.
 failed:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_transition(d2,courier,'deliver',key2,p1);
 EXCEPTION WHEN SQLSTATE 'G6703' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'G67 reused proof on other delivery'; END IF;
 PERFORM public.mobility_stage_g67_revoke_proof_qa(p2,reviewer);
 failed:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_transition(d2,courier,'deliver',key2,p2);
 EXCEPTION WHEN SQLSTATE 'G6703' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'G67 revoked proof accepted'; END IF;
 IF (SELECT status FROM public.mobility_stage_deliveries WHERE id=d2)<>'picked_up'
 OR (SELECT status FROM public.mobility_stage_g67_delivery_proofs WHERE proof_ref=p2)<>'revoked'
 THEN RAISE EXCEPTION 'G67 failed transition mutated custody'; END IF;
 RAISE NOTICE 'G67 PASS: grants, forged/self/cross/duplicate, rollback, committed G5 event, replay, revocation';
END $tests$;
ROLLBACK;
