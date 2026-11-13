-- G329: synthetic CI-only PostgreSQL17. NEVER run on Supabase STAGING.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database()<>'qore_g329_ci'
 THEN RAISE EXCEPTION 'G329 CI_ONLY refuses persistent database'; END IF;
END $guard$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA qore_stage_internal;
CREATE TYPE public.mobility_service_kind AS ENUM ('economico','confort','xl','moto_pasajero');
CREATE TYPE public.app_role AS ENUM ('passenger','driver','admin','owner');
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.user_roles(user_id uuid NOT NULL REFERENCES auth.users(id),role public.app_role NOT NULL);
CREATE TABLE public.mobility_stage_g73_auto_routes(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id),
 service public.mobility_service_kind NOT NULL,
 origin_tag text NOT NULL,destination_tag text NOT NULL,zone_tag text NOT NULL,
 distance_meters integer NOT NULL,duration_seconds integer NOT NULL,
 tolls_pyg integer NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL
);

INSERT INTO auth.users VALUES
 ('32900000-0000-4329-8329-000000000001'),
 ('32900000-0000-4329-8329-000000000002');
INSERT INTO public.user_roles VALUES
 ('32900000-0000-4329-8329-000000000001','passenger'),
 ('32900000-0000-4329-8329-000000000002','driver');
\ir ../migrations/g329_private_pinned_auto_route_pg17_DRAFT.sql

DO $acl$ BEGIN
 IF has_function_privilege('anon',
  'public.mobility_stage_g329_route_pinned_receipt(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g329_route_pinned_receipt(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g329_route_pinned_receipt(uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role',
  'qore_stage_internal.mobility_stage_g329_auto_pinned_routes','SELECT')
 OR has_table_privilege('authenticated',
  'qore_stage_internal.mobility_stage_g329_auto_pinned_routes','SELECT')
 OR has_table_privilege('anon',
  'qore_stage_internal.mobility_stage_g329_auto_pinned_routes','INSERT')
 THEN RAISE EXCEPTION 'G329 private ACL regression'; END IF;
END $acl$;

SET ROLE service_role;
-- Service role only: route and pin evidence must commit atomically.
SELECT public.mobility_stage_g329_route_pinned(
 '32900000-0000-4329-8329-000000000001',
 '32900000-0000-4329-8329-000000000010','economico',
 'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
 '32900000-0000-4329-8329-000000000020',
 -25.4061,-54.6302,-25.5092,-54.6115,
 (extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint
) AS route_id \gset
-- SQL-level assertions avoid substituting psql variables into DO dollar strings.
SELECT 1/(CASE WHEN
 r->>'pinBound'='true' AND r->>'commercialEnabled'='false'
 AND r->>'pinEvidenceId'='32900000-0000-4329-8329-000000000020'
 AND r->>'ownerId'='32900000-0000-4329-8329-000000000001'
 THEN 1 ELSE 0 END) AS assert_pinned_receipt
FROM (SELECT public.mobility_stage_g329_route_pinned_receipt(
 '32900000-0000-4329-8329-000000000001', :'route_id'::uuid) AS r) x;
SELECT 1/(CASE WHEN public.mobility_stage_g329_route_pinned_receipt(
 '32900000-0000-4329-8329-000000000002', :'route_id'::uuid) IS NULL
 THEN 1 ELSE 0 END) AS assert_cross_actor_isolation;

-- Idempotent retry: keep original evidence timestamp stable by getting the
-- server-side stored millisecond value; do not manufacture a new timestamp.
RESET ROLE;
SELECT (extract(epoch FROM verified_at)*1000)::bigint AS verified_at_ms
FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes
WHERE route_id=:'route_id'::uuid \gset
SET ROLE service_role;
SELECT 1/(CASE WHEN public.mobility_stage_g329_route_pinned(
 '32900000-0000-4329-8329-000000000001',
 '32900000-0000-4329-8329-000000000010','economico',
 'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
 '32900000-0000-4329-8329-000000000020',
 -25.4061,-54.6302,-25.5092,-54.6115,:verified_at_ms
) = :'route_id'::uuid THEN 1 ELSE 0 END) AS assert_idempotent_retry;

-- A replay with altered evidence must NEVER modify original record.
DO $reject$
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g329_route_pinned(
  '32900000-0000-4329-8329-000000000001',
  '32900000-0000-4329-8329-000000000010','economico',
  'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
  '32900000-0000-4329-8329-000000000099',
  -25.4061,-54.6302,-25.5092,-54.6115,
  (extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint);
  RAISE EXCEPTION 'G329 accepted changed route evidence';
 EXCEPTION WHEN SQLSTATE 'P3291' THEN NULL; END;
 BEGIN
  PERFORM public.mobility_stage_g329_route_pinned(
  '32900000-0000-4329-8329-000000000001',
  '32900000-0000-4329-8329-000000000011','economico',
  'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
  '32900000-0000-4329-8329-000000000021',
  -25.4061,-54.6302,-25.5092,-54.6115,
  (extract(epoch FROM pg_catalog.clock_timestamp()-interval '2 minutes')*1000)::bigint);
  RAISE EXCEPTION 'G329 accepted expired evidence';
 EXCEPTION WHEN SQLSTATE 'P3291' THEN NULL; END;
 BEGIN
  PERFORM public.mobility_stage_g329_route_pinned(
  '32900000-0000-4329-8329-000000000002',
  '32900000-0000-4329-8329-000000000012','economico',
  'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
  '32900000-0000-4329-8329-000000000022',
  -25.4061,-54.6302,-25.5092,-54.6115,
  (extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint);
  RAISE EXCEPTION 'G329 accepted Driver as passenger';
 EXCEPTION WHEN SQLSTATE 'P3291' THEN NULL; END;
END $reject$;
-- The same attestation cannot be reused for a different request key.
-- Unique violation must roll back the entire attempted G73 insert.
DO $proof_unique$ BEGIN
 BEGIN
  PERFORM public.mobility_stage_g329_route_pinned(
   '32900000-0000-4329-8329-000000000001',
   '32900000-0000-4329-8329-000000000014','economico',
   'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
   '32900000-0000-4329-8329-000000000020',
   -25.4061,-54.6302,-25.5092,-54.6115,
   (extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint);
  RAISE EXCEPTION 'G329 accepted reused attestation for second request';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $proof_unique$;
RESET ROLE;
-- Legacy route key with no proof must not be upgraded after the fact.
INSERT INTO public.mobility_stage_g73_auto_routes(
 request_key,passenger_id,service,origin_tag,destination_tag,zone_tag,
 distance_meters,duration_seconds,tolls_pyg,expires_at)
 VALUES('32900000-0000-4329-8329-000000000013',
 '32900000-0000-4329-8329-000000000001','economico',
 'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
 pg_catalog.clock_timestamp()+interval '10 minutes');
SET ROLE service_role;
DO $legacy$ BEGIN
 BEGIN
  PERFORM public.mobility_stage_g329_route_pinned(
  '32900000-0000-4329-8329-000000000001',
  '32900000-0000-4329-8329-000000000013','economico',
  'HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',5000,620,0,
  '32900000-0000-4329-8329-000000000023',
  -25.4061,-54.6302,-25.5092,-54.6115,
  (extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint);
  RAISE EXCEPTION 'G329 retrofitted legacy route proof';
 EXCEPTION WHEN SQLSTATE 'P3291' THEN NULL; END;
END $legacy$;
RESET ROLE;
DO $counts$ BEGIN
 IF (SELECT count(*) FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes)<>1
 OR (SELECT count(*) FROM public.mobility_stage_g73_auto_routes)<>2
 THEN RAISE EXCEPTION 'G329 atomic rollback/idempotency row count failed'; END IF;
 RAISE NOTICE 'G329 PG17 private pin route tests PASS — CI ONLY; no STAGING changes';
END $counts$;
