-- G42 real PostgreSQL disposable: authorized, absent, revoked, foreign,
-- expired, stale iat and browser DML denial. No production Auth claims.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g42_provider_session_grants') IS NULL
 THEN RAISE EXCEPTION 'G42 QA must be disposable'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('42420000-0000-4242-8242-000000000001'),
 ('42420000-0000-4242-8242-000000000002')
ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,
 evidence_kind
) VALUES
 ('42420000-0000-4242-8242-000000000001',
  '42420000-0000-4242-8242-000000000101',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('42420000-0000-4242-8242-000000000001',
  '42420000-0000-4242-8242-000000000102',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()-interval '1 second','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('42420000-0000-4242-8242-000000000002',
  '42420000-0000-4242-8242-000000000201',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp()
 WHERE session_id='42420000-0000-4242-8242-000000000201';
DO $grants$
BEGIN
 IF has_table_privilege('service_role',
  'public.mobility_stage_g42_provider_session_grants','INSERT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g42_provider_session_grants','SELECT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_g42_provider_session_grants','SELECT')
 OR has_function_privilege('anon',
  'public.mobility_stage_g42_session_active(uuid,uuid,bigint)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g42_lock_session(uuid,uuid,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'G42 session table/guard grants leaked'; END IF;
END $grants$;
SET LOCAL ROLE service_role;
DO $tests$
DECLARE now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 owner uuid:='42420000-0000-4242-8242-000000000001';
 active uuid:='42420000-0000-4242-8242-000000000101';
 expired uuid:='42420000-0000-4242-8242-000000000102';
 revoked uuid:='42420000-0000-4242-8242-000000000201';
 denied boolean:=false;
BEGIN
 IF NOT public.mobility_stage_g42_session_active(owner,active,now_ms)
 OR NOT public.mobility_stage_g42_lock_session(owner,active,now_ms)
 OR NOT public.mobility_stage_g42_session_active(owner,active,NULL)
 THEN RAISE EXCEPTION 'G42 current independently granted session denied'; END IF;
 IF public.mobility_stage_g42_session_active(owner,expired,now_ms)
 OR public.mobility_stage_g42_session_active(owner,revoked,now_ms)
 OR public.mobility_stage_g42_session_active(
   '42420000-0000-4242-8242-000000000002',active,now_ms)
 OR public.mobility_stage_g42_session_active(owner,
   '42420000-0000-4242-8242-000000000199',now_ms)
 OR public.mobility_stage_g42_session_active(owner,active,now_ms-3600000)
 OR public.mobility_stage_g42_session_active(owner,active,-1)
 OR public.mobility_stage_g42_lock_session(owner,expired,now_ms)
 THEN RAISE EXCEPTION 'G42 absent/cross-actor/revoked/expired/stale session accepted'; END IF;
 BEGIN
  UPDATE public.mobility_stage_g42_provider_session_grants
  SET revoked_at=clock_timestamp() WHERE user_id=owner;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G42 service role can revoke/forge sessions'; END IF;
 RAISE NOTICE 'G42 PASS: scoped grant, immediate revocation, TTL, iat and private SQL rights';
END $tests$;
RESET ROLE;
UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id='42420000-0000-4242-8242-000000000001'
 AND session_id='42420000-0000-4242-8242-000000000101';
SET LOCAL ROLE service_role;
DO $revoked$
BEGIN
 IF public.mobility_stage_g42_session_active(
  '42420000-0000-4242-8242-000000000001',
  '42420000-0000-4242-8242-000000000101',NULL)
 THEN RAISE EXCEPTION 'G42 revoked active grant remains usable'; END IF;
END $revoked$;
RESET ROLE;
ROLLBACK;
