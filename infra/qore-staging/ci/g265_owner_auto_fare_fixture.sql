-- G265 ephemeral-only fixture. Never run against real STAGING or production.
-- Follows g262_minimal_schema.sql and its generated PG16/17 temporary DB.
DELETE FROM public.mobility_stage_fare_rules;
ALTER TABLE public.mobility_stage_fare_rules
 ADD COLUMN approved_by uuid NOT NULL REFERENCES auth.users(id),
 ADD COLUMN approved_at timestamptz NOT NULL;
CREATE UNIQUE INDEX mobility_stage_one_active_fare_rule
 ON public.mobility_stage_fare_rules(mode,zone_tag) WHERE active=true;
CREATE TABLE public.mobility_stage_backoffice_roles(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN ('owner','admin')),
 status text NOT NULL CHECK(status IN ('active','pending','suspended')),
 approved_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TYPE auth.aal_level AS ENUM('aal1','aal2','aal3');
CREATE TABLE auth.sessions(
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 aal auth.aal_level NOT NULL,
 issued_at_ms bigint NOT NULL,
 revoked boolean NOT NULL DEFAULT false
);
CREATE FUNCTION public.mobility_stage_g42_session_active(
 _user uuid,_session uuid,_iat_ms bigint
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM auth.sessions s
 WHERE s.user_id=$1 AND s.id=$2 AND s.issued_at_ms=$3 AND NOT s.revoked)
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g42_session_active(
 uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g42_session_active(
 uuid,uuid,bigint) TO service_role;
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000901'),
 ('00000000-0000-4000-8000-000000000902'),
 ('00000000-0000-4000-8000-000000000903');
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('00000000-0000-4000-8000-000000000901','owner','active',
 '00000000-0000-4000-8000-000000000902');
INSERT INTO auth.sessions(id,user_id,aal,issued_at_ms) VALUES
 ('00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000901','aal2',1761930000000),
 ('00000000-0000-4000-8000-000000000912',
  '00000000-0000-4000-8000-000000000901','aal1',1761930000000),
 ('00000000-0000-4000-8000-000000000913',
  '00000000-0000-4000-8000-000000000903','aal2',1761930000000);
