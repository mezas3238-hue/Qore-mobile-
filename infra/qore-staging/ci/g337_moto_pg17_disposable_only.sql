-- G337 disposable PG17 ONLY. This file MUST NEVER be applied to STAGING.
-- Safety guard is before any fixture, role, DDL or inserted synthetic actors.
DO $gate$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_g337'
  OR pg_catalog.current_setting('application_name')<>'qore_disposable_chain'
  OR pg_catalog.current_setting('server_version_num')::integer<170000
 THEN RAISE EXCEPTION 'G337 disposable-only guard refuses this database'
   USING ERRCODE='P3379'; END IF;
END $gate$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA qore_stage_internal;
CREATE TABLE auth.users(
 id uuid PRIMARY KEY,
 email_confirmed_at timestamptz,
 phone_confirmed_at timestamptz
);
CREATE TYPE public.app_role AS ENUM('admin','driver','passenger');
CREATE TABLE public.user_roles(
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role public.app_role NOT NULL
);
CREATE TYPE public.mobility_stage_fare_mode AS ENUM('AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY');
CREATE TABLE public.mobility_stage_fare_rules(
 id uuid PRIMARY KEY,
 rule_key text NOT NULL,
 mode public.mobility_stage_fare_mode NOT NULL,
 zone_tag text NOT NULL,
 base_pyg integer NOT NULL,
 per_km_pyg integer NOT NULL,
 per_minute_pyg integer NOT NULL,
 minimum_pyg integer NOT NULL,
 commission_bps integer NOT NULL,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 active boolean NOT NULL,
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL
);
CREATE TABLE public.mobility_stage_backoffice_roles(
 user_id uuid NOT NULL PRIMARY KEY,
 role text NOT NULL,
 status text NOT NULL,
 revision bigint NOT NULL DEFAULT 1,
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL
);
-- Synthetic actors exist in disposable CI only. NO test identity in STAGING.
INSERT INTO auth.users VALUES
 ('33700000-0000-4337-8337-000000000001',clock_timestamp(),NULL),
 ('33700000-0000-4337-8337-000000000002',clock_timestamp(),NULL),
 ('33700000-0000-4337-8337-000000000003',clock_timestamp(),NULL);
INSERT INTO public.user_roles VALUES
 ('33700000-0000-4337-8337-000000000001','passenger'),
 ('33700000-0000-4337-8337-000000000002','passenger');
INSERT INTO public.mobility_stage_backoffice_roles VALUES
 ('33700000-0000-4337-8337-000000000003','owner','active',1,
  '33700000-0000-4337-8337-000000000003',clock_timestamp());
INSERT INTO public.mobility_stage_fare_rules VALUES(
 '33700000-0000-4337-8337-000000000004','native-moto-qa','MOTO',
 'ASUNCION',10000,2000,500,10000,2000,
 clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day',
 true,'33700000-0000-4337-8337-000000000003',clock_timestamp()
);

-- psql meta directive uses path relative to this guarded fixture.
\ir ../migrations/g337_private_moto_native_pg17_DRAFT_NOT_DEPLOYED.sql

DO $checks$
DECLARE
 passenger uuid := '33700000-0000-4337-8337-000000000001';
 other_actor uuid := '33700000-0000-4337-8337-000000000002';
 quote_key uuid := '33700000-0000-4337-8337-000000000005';
 booking_key uuid := '33700000-0000-4337-8337-000000000006';
 cancel_key uuid := '33700000-0000-4337-8337-000000000007';
 q jsonb;
 replay_q jsonb;
 t jsonb;
 replay_t jsonb;
 cancellation jsonb;
 replay_cancel jsonb;
 st jsonb;
BEGIN
 IF pg_catalog.has_function_privilege('anon',
  'public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer)',
  'EXECUTE') IS NOT FALSE
  OR pg_catalog.has_function_privilege('authenticated',
  'public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer)',
  'EXECUTE') IS NOT FALSE
  OR pg_catalog.has_function_privilege('service_role',
  'public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer)',
  'EXECUTE') IS NOT TRUE
 THEN RAISE EXCEPTION 'G337 unauthorized direct RPC privileges' USING ERRCODE='P3379'; END IF;
 q:=public.mobility_stage_g100_moto_quote_qa(passenger,quote_key,
  'VILLA_MORRA','CENTRO','ASUNCION',2100,300);
 IF q->>'mode'<>'STAGING_DEMO_ONLY'
  OR (q->>'commercialEnabled')::boolean IS DISTINCT FROM false
  OR (q->>'driverAssigned')::boolean IS DISTINCT FROM false
  OR (q->>'pspCollected')::boolean IS DISTINCT FROM false
  OR (q->>'serverPersisted')::boolean IS DISTINCT FROM true
  OR (q->>'amountGs')::integer<>16700
  OR (q->>'customerPaysGs')::integer<>15030
  OR (q->>'driverReceivesGs')::integer<>13360
  OR (q->>'platformRetainsGs')::integer<>1670
  OR (q->>'subsidyBps')::integer<>1000
  OR (q->>'commissionBps')::integer<>2000
 THEN RAISE EXCEPTION 'G337 unverified Owner-rated MOTO quotation: %',q USING ERRCODE='P3379'; END IF;
 replay_q:=public.mobility_stage_g100_moto_quote_qa(passenger,quote_key,
  'VILLA_MORRA','CENTRO','ASUNCION',2100,300);
 IF q->>'quoteId' IS DISTINCT FROM replay_q->>'quoteId'
 THEN RAISE EXCEPTION 'G337 quote replay mutated original' USING ERRCODE='P3379'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g100_moto_quote_qa(other_actor,quote_key,
   'VILLA_MORRA','CENTRO','ASUNCION',2100,300);
  RAISE EXCEPTION 'G337 other actor reused quote key' USING ERRCODE='P3379';
 EXCEPTION WHEN SQLSTATE 'P3372' THEN NULL;
 END;
 t:=public.mobility_stage_g100_moto_book_qa(passenger,(q->>'quoteId')::uuid,booking_key);
 IF t->>'tripState'<>'searching' OR (t->>'tripRevision')::integer<>1
  OR t->>'financialState'<>'RESERVED_QA'
  OR (t->>'reversalEntriesBalanced')::boolean IS DISTINCT FROM false
  OR (t->>'pspRefunded')::boolean IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G337 booking not committed or falsely settled: %',t USING ERRCODE='P3379'; END IF;
 replay_t:=public.mobility_stage_g100_moto_book_qa(passenger,(q->>'quoteId')::uuid,booking_key);
 IF replay_t->>'tripId' IS DISTINCT FROM t->>'tripId'
 THEN RAISE EXCEPTION 'G337 duplicate booking' USING ERRCODE='P3379'; END IF;
 st:=public.mobility_stage_g118_moto_status_qa(passenger,booking_key);
 IF st->>'tripState'<>'searching' OR (st->>'driverAssigned')::boolean IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G337 false driver assignment' USING ERRCODE='P3379'; END IF;
 cancellation:=public.mobility_stage_g100_moto_cancel_qa(passenger,booking_key,cancel_key);
 IF cancellation->>'tripState'<>'cancelled'
  OR (cancellation->>'reversalEntriesBalanced')::boolean IS DISTINCT FROM true
  OR cancellation->>'financialState'<>'VOIDED_QA'
 THEN RAISE EXCEPTION 'G337 cancellation not balanced: %',cancellation USING ERRCODE='P3379'; END IF;
 replay_cancel:=public.mobility_stage_g100_moto_cancel_qa(passenger,booking_key,cancel_key);
 IF replay_cancel->>'cancellationEventId' IS DISTINCT FROM cancellation->>'cancellationEventId'
 THEN RAISE EXCEPTION 'G337 duplicate cancellation' USING ERRCODE='P3379'; END IF;
 st:=public.mobility_stage_g118_moto_status_qa(passenger,booking_key);
 IF st->>'tripState'<>'cancelled' OR st->>'financialState'<>'VOIDED_QA'
 THEN RAISE EXCEPTION 'G337 cancellation status discrepancy' USING ERRCODE='P3379'; END IF;
 IF (SELECT pg_catalog.count(*) FROM qore_stage_internal.g337_moto_ledger)<>6
 THEN RAISE EXCEPTION 'G337 duplicate or missing simulated ledger legs' USING ERRCODE='P3379'; END IF;
 RAISE NOTICE 'G337 DISPOSABLE PG17 ONLY: native MOTO quote/book/status/cancel/idempotency/ledger PASS; E2E EXTERNAL NOT CERTIFIED';
END $checks$;
