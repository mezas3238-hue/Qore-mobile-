\set ON_ERROR_STOP on
-- G68 own-delivery contract / two Passenger principals, PG16 disposable ONLY.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g68_sender_custody_owner_qa(uuid,uuid,bigint,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G68 ASSERT refuses incomplete/disconnected DB'; END IF;
END $guard$;
BEGIN;
DO $assert$
DECLARE
 actor uuid:='68010000-0000-4680-8680-000000000001';
 outsider uuid:='68010000-0000-4680-8680-000000000002';
 driver uuid:='11111111-1111-4111-8111-111111111111';
 own_session uuid:='68010000-0000-4680-8680-000000000011';
 other_session uuid:='68010000-0000-4680-8680-000000000012';
 d uuid:='68010000-0000-4680-8680-000000000020';
 issued bigint; dto jsonb; blocked boolean;
BEGIN
 FOR role_name IN SELECT unnest(ARRAY['anon','authenticated','service_role'])
 LOOP
  IF pg_catalog.has_function_privilege(role_name,
   'public.mobility_stage_g68_sender_custody_owner_qa(uuid,uuid,bigint,uuid)',
   'EXECUTE') THEN RAISE EXCEPTION 'G68 leaked owner-only read to %',role_name; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc
 WHERE oid='public.mobility_stage_g68_sender_custody_owner_qa(uuid,uuid,bigint,uuid)'::regprocedure
 AND prosecdef=true)
 THEN RAISE EXCEPTION 'G68 expected SECURITY DEFINER'; END IF;
 -- Two entirely synthetic, independent Passengers; new-signup trigger grants role.
 INSERT INTO auth.users(id) VALUES(actor),(outsider);
 IF (SELECT count(*) FROM public.user_roles
  WHERE user_id=actor AND role='passenger'::public.app_role)<>1
 OR (SELECT count(*) FROM public.user_roles
  WHERE user_id=outsider AND role='passenger'::public.app_role)<>1
 THEN RAISE EXCEPTION 'G68 synthetic Passenger fixture missing'; END IF;
 INSERT INTO public.mobility_stage_deliveries
  (id,request_key,sender_id,requested_vehicle_kind,category,grams,
   length_cm,width_cm,height_cm,pickup_tag,delivery_tag)
 VALUES(d,'68010000-0000-4680-8680-000000000030',actor,'MOTO',
  'PARCEL',700,9,9,9,'CENTRO_G68','LAMBRARE_G68');
 INSERT INTO public.mobility_stage_g42_provider_session_grants
  (user_id,session_id,provider_confirmed_at,token_allowed_from,
   valid_until,evidence_kind)
 VALUES
  (actor,own_session,clock_timestamp()-interval '1 day',
   clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
   'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
  (outsider,other_session,clock_timestamp()-interval '1 day',
   clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
   'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
 issued:=(extract(epoch FROM clock_timestamp())*1000)::bigint;
 dto:=public.mobility_stage_g68_sender_custody_owner_qa(
  actor,own_session,issued,d);
 IF pg_catalog.jsonb_object_length(dto)<>11
 OR dto->>'ownerId'<>actor::text OR dto->>'deliveryId'<>d::text
 OR dto->>'state'<>'requested' OR (dto->>'revision')::integer<>1
 OR dto->>'vehicleKind'<>'MOTO'
 OR dto->>'proofVerified'<>'false'
 OR dto->>'assignmentPersisted'<>'false'
 OR dto->>'productionEnabled'<>'false'
 OR dto ? 'proofRef' OR dto ? 'courierId' OR dto ? 'phone'
 THEN RAISE EXCEPTION 'G68 unsafe or mismatched Passenger DTO: %',dto; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g68_sender_custody_owner_qa(
   outsider,other_session,issued,d);
 EXCEPTION WHEN SQLSTATE 'G6804' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G68 stranger read sender delivery'; END IF;
 -- Verified token but no longer active session: reject without leaking scope.
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=actor AND session_id=own_session;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g68_sender_custody_owner_qa(
   actor,own_session,issued,d);
 EXCEPTION WHEN SQLSTATE 'G6802' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G68 revoked session read delivery'; END IF;
 RAISE NOTICE 'G68 PASS: exact B R62 DTO, sender SQL ownership, cross-user invisibility, revoked G42 and denied roles';
END $assert$;
ROLLBACK;
