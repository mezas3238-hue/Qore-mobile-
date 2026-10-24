-- G43 SQL adversarial proof: denied role, wrong actor/iat, revoked
-- session, failed operation does not persist effects (isolated PG16 ONLY).
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g43_guarded_probe(uuid,uuid,uuid,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G43 assert refuses unsafe database'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id)
 VALUES('43430000-0000-4343-8343-000000000001'),
       ('43430000-0000-4343-8343-000000000002')
 ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,
 evidence_kind
) VALUES(
 '43430000-0000-4343-8343-000000000001',
 '43430000-0000-4343-8343-000000000101',
 clock_timestamp()-interval '1 hour',clock_timestamp()-interval '1 minute',
 clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
);
DO $tests$
DECLARE
 actor uuid:='43430000-0000-4343-8343-000000000001';
 session uuid:='43430000-0000-4343-8343-000000000101';
 current_iat bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 denied boolean:=false;
BEGIN
 IF has_table_privilege('service_role',
    'public.mobility_stage_g43_guarded_effects','INSERT')
 OR has_function_privilege('service_role',
    'public.mobility_stage_g43_guarded_probe(uuid,uuid,uuid,bigint)','EXECUTE')
 OR has_function_privilege('authenticated',
    'public.mobility_stage_g43_guarded_probe(uuid,uuid,uuid,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'G43 probe publicly callable'; END IF;
 PERFORM public.mobility_stage_g43_guarded_probe(
  '43430000-0000-4343-8343-000000000201',actor,session,current_iat);
 BEGIN
  PERFORM public.mobility_stage_g43_guarded_probe(
   '43430000-0000-4343-8343-000000000202',
   '43430000-0000-4343-8343-000000000002',session,current_iat);
 EXCEPTION WHEN SQLSTATE 'G4301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G43 cross-actor write allowed'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g43_guarded_probe(
   '43430000-0000-4343-8343-000000000203',
   actor,session,current_iat-3600000);
 EXCEPTION WHEN SQLSTATE 'G4301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G43 pre-confirmation token accepted'; END IF;
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=actor AND session_id=session;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g43_guarded_probe(
   '43430000-0000-4343-8343-000000000204',
   actor,session,current_iat);
 EXCEPTION WHEN SQLSTATE 'G4301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G43 revoked session wrote after revoke'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g43_guarded_effects
     WHERE user_id=actor)<>1
 THEN RAISE EXCEPTION 'G43 unauthorized effect persisted'; END IF;
 RAISE NOTICE 'G43 SQL PASS: only owner-owned probe; wrong user/iat and revoke fail-closed';
END $tests$;
SET LOCAL ROLE service_role;
DO $role$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g43_guarded_probe(
   '43430000-0000-4343-8343-000000000205',
   '43430000-0000-4343-8343-000000000001',
   '43430000-0000-4343-8343-000000000101',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G43 service_role invoked owner-only probe'; END IF;
END $role$;
RESET ROLE;
ROLLBACK;
