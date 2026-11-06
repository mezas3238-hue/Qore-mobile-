\set ON_ERROR_STOP on
-- G312 DISPOSABLE PG16 QA only. Never run this file against Supabase.
-- Synthetic Auth fixtures model only the columns referenced by G301.
DO $init$
BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN
  CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN
  CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN
  CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$init$;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
CREATE FUNCTION auth.jwt() RETURNS jsonb
 LANGUAGE sql STABLE AS $jwt$
 SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
 $jwt$;
CREATE FUNCTION auth.uid() RETURNS uuid
 LANGUAGE sql STABLE AS $uid$
 SELECT NULLIF(auth.jwt()->>'sub','')::uuid
 $uid$;

CREATE TABLE auth.users (
 id uuid PRIMARY KEY,
 is_anonymous boolean NOT NULL DEFAULT false,
 email_confirmed_at timestamptz,
 phone_confirmed_at timestamptz
);
CREATE TABLE auth.mfa_factors (
 id uuid PRIMARY KEY,user_id uuid NOT NULL,
 factor_type text NOT NULL,status text NOT NULL
);
CREATE TABLE auth.sessions (
 id uuid PRIMARY KEY,user_id uuid NOT NULL,
 factor_id uuid,aal text NOT NULL,not_after timestamptz
);
CREATE TABLE public.user_roles(user_id uuid PRIMARY KEY,role text);
CREATE TABLE public.mobility_stage_backoffice_roles(
 user_id uuid PRIMARY KEY,role text,status text,approved_by uuid
);

-- The exact G301 bootstrap + G312 private queue proposal.
\ir ../../../mobility-expo/docs/g301-support-staging-schema.sql
\ir ../../sql/g312-support-private-action-requests-draft.sql

-- The new action table is never exposed to a browser, Owner or
-- anonymous user. service_role only reads/inserts; no mutations of
-- tickets or requests may occur through a client Data API.
DO $permissions$ BEGIN
 IF has_table_privilege('anon','public.mobility_stage_support_action_requests','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_support_action_requests','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_support_action_requests','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_support_action_requests','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_support_action_requests','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_support_action_requests','DELETE')
 OR NOT has_table_privilege('service_role','public.mobility_stage_support_action_requests','INSERT')
 OR NOT has_table_privilege('service_role','public.mobility_stage_support_action_requests','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_support_agents','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_support_cases','UPDATE')
 OR has_column_privilege('authenticated','public.mobility_stage_support_cases','requester_user_id','SELECT')
 THEN RAISE EXCEPTION 'G312 FAIL: support privileges are overly broad'; END IF;
END $permissions$;

-- Synthetic identities only. Owner approval never creates a support
-- login automatically, and no Owner inherits Support.
INSERT INTO auth.users(id,email_confirmed_at)
 VALUES
 ('11111111-1111-4111-8111-111111111111',now()),
 ('22222222-2222-4222-8222-222222222222',now()),
 ('33333333-3333-4333-8333-333333333333',now()),
 ('44444444-4444-4444-8444-444444444444',now());
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('11111111-1111-4111-8111-111111111111','owner','active',
  '99999999-9999-4999-8999-999999999999');
INSERT INTO public.user_roles(user_id,role)
 VALUES('44444444-4444-4444-8444-444444444444','passenger');
INSERT INTO public.mobility_stage_support_agents(user_id,status,approved_by)
 VALUES
 ('22222222-2222-4222-8222-222222222222','active',
  '11111111-1111-4111-8111-111111111111'),
 ('33333333-3333-4333-8333-333333333333','active',
  '11111111-1111-4111-8111-111111111111');
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status)
 VALUES
 ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222','totp','verified'),
 ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333333','totp','verified'),
 ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','totp','verified');
INSERT INTO auth.sessions(id,user_id,factor_id,aal,not_after)
 VALUES
 ('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aal2',now()+interval '10 minutes'),
 ('bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aal2',now()+interval '10 minutes'),
 ('bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aal2',now()+interval '10 minutes');
INSERT INTO public.mobility_stage_support_cases(
 ticket_id,case_code,requester_user_id,assigned_support_id,
 category,summary,status,priority)
 VALUES
 ('ddddddd1-dddd-4ddd-8ddd-dddddddddddd','MF-2026-001',
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'VIAJE_AUTO','Demora reportada en viaje','OPEN','NORMAL'),
 ('ddddddd2-dddd-4ddd-8ddd-dddddddddddd','MF-2026-002',
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'ENVIO_MOTO','Entrega demorada en recorrido','OPEN','NORMAL'),
 ('ddddddd3-dddd-4ddd-8ddd-dddddddddddd','MF-2026-003',
  '44444444-4444-4444-8444-444444444444',
  NULL,'COMERCIO','Solicitud general de atención','OPEN','HIGH');

-- AAL2 support agent A: only assigned ticket #1 and open queue #3.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object(
  'sub','22222222-2222-4222-8222-222222222222',
  'session_id','bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aal','aal2','role','authenticated','is_anonymous',false)::text,false);
DO $agent_a$
DECLARE visible int; forbidden int;
BEGIN
 IF public.mobility_stage_support_my_role() IS DISTINCT FROM 'support'
 THEN RAISE EXCEPTION 'G312 AAL2 support A denied'; END IF;
 SELECT count(*) INTO visible FROM public.mobility_stage_support_cases;
 SELECT count(*) INTO forbidden FROM public.mobility_stage_support_cases
 WHERE case_code='MF-2026-002';
 IF visible<>2 OR forbidden<>0
 THEN RAISE EXCEPTION 'G312 agent A horizontal access violation'; END IF;
END $agent_a$;
-- Any browser/agent trying to INSERT outbox directly is denied.
DO $deny$
DECLARE forbidden boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.mobility_stage_support_action_requests(
   ticket_id,agent_id,action,expected_status,idempotency_key)
   VALUES('ddddddd1-dddd-4ddd-8ddd-dddddddddddd',
          '22222222-2222-4222-8222-222222222222',
          'ACKNOWLEDGE','OPEN','eeeeeee1-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN insufficient_privilege THEN forbidden:=true; END;
 IF NOT forbidden
 THEN RAISE EXCEPTION 'G312 browser directly enqueued an action'; END IF;
END $deny$;
RESET ROLE;

-- AAL1 (password only) cannot see cases even if staff record active.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub','22222222-2222-4222-8222-222222222222',
  'session_id','bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aal','aal1','role','authenticated')::text,false);
DO $aal1$
BEGIN
 IF public.mobility_stage_support_my_role() IS NOT NULL OR
  (SELECT count(*) FROM public.mobility_stage_support_cases)<>0
 THEN RAISE EXCEPTION 'G312 password-only staff read cases'; END IF;
END $aal1$;
RESET ROLE;

-- Owner with AAL2 (even if approver) does NOT inherit Support.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub','11111111-1111-4111-8111-111111111111',
  'session_id','bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aal','aal2','role','authenticated')::text,false);
DO $owner$
BEGIN
 IF public.mobility_stage_support_my_role() IS NOT NULL OR
  (SELECT count(*) FROM public.mobility_stage_support_cases)<>0
 THEN RAISE EXCEPTION 'G312 owner inherited support'; END IF;
END $owner$;
RESET ROLE;

-- Agent B can see own and unassigned; not A's case.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub','33333333-3333-4333-8333-333333333333',
  'session_id','bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aal','aal2','role','authenticated')::text,false);
DO $agent_b$
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_support_cases)<>2 OR
  (SELECT count(*) FROM public.mobility_stage_support_cases
   WHERE case_code='MF-2026-001')<>0
 THEN RAISE EXCEPTION 'G312 agent B horizontal access violation'; END IF;
END $agent_b$;
RESET ROLE;

-- Expiry and revocation have to be checked against CURRENT server data.
UPDATE auth.sessions SET not_after=now()-interval '1 second'
 WHERE user_id='22222222-2222-4222-8222-222222222222';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub','22222222-2222-4222-8222-222222222222',
  'session_id','bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aal','aal2','role','authenticated')::text,false);
DO $expired$
BEGIN
 IF public.mobility_stage_support_my_role() IS NOT NULL OR
  (SELECT count(*) FROM public.mobility_stage_support_cases)<>0
 THEN RAISE EXCEPTION 'G312 expired session still authorized'; END IF;
END $expired$;
RESET ROLE;
UPDATE auth.sessions SET not_after=now()+interval '10 minutes'
 WHERE user_id='22222222-2222-4222-8222-222222222222';
UPDATE public.mobility_stage_support_agents SET status='revoked'
 WHERE user_id='22222222-2222-4222-8222-222222222222';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub','22222222-2222-4222-8222-222222222222',
  'session_id','bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aal','aal2','role','authenticated')::text,false);
DO $revoked$
BEGIN
 IF public.mobility_stage_support_my_role() IS NOT NULL OR
  (SELECT count(*) FROM public.mobility_stage_support_cases)<>0
 THEN RAISE EXCEPTION 'G312 revoked staff still authorized'; END IF;
END $revoked$;
RESET ROLE;

-- Trusted server (test fixture only) may queue one intent and replay
-- with same idempotency key must not create a second row.
SET ROLE service_role;
INSERT INTO public.mobility_stage_support_action_requests(
 ticket_id,agent_id,action,expected_status,idempotency_key)
 VALUES('ddddddd1-dddd-4ddd-8ddd-dddddddddddd',
        '22222222-2222-4222-8222-222222222222',
        'ACKNOWLEDGE','OPEN','eeeeeee1-eeee-4eee-8eee-eeeeeeeeeeee');
DO $idempotency$
DECLARE duplicate boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.mobility_stage_support_action_requests(
   ticket_id,agent_id,action,expected_status,idempotency_key)
   VALUES('ddddddd1-dddd-4ddd-8ddd-dddddddddddd',
          '22222222-2222-4222-8222-222222222222',
          'ACKNOWLEDGE','OPEN','eeeeeee1-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN unique_violation THEN duplicate:=true; END;
 IF NOT duplicate OR
  (SELECT count(*) FROM public.mobility_stage_support_action_requests)<>1
 THEN RAISE EXCEPTION 'G312 duplicate idempotency request accepted'; END IF;
END $idempotency$;
RESET ROLE;

\echo G312 PASS: private queue, minimal RLS, exclusive support A/B, AAL2, owner denial, expired/revoked deny, append-only, idempotency. NO LIVE.
