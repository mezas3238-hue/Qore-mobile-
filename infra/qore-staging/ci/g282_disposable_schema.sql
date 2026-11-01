-- G282 disposable CI fixture. NEVER apply to Supabase or user QA accounts.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA qore_stage_internal;
GRANT USAGE ON SCHEMA public,qore_stage_internal TO service_role;
CREATE TYPE public.app_role AS ENUM('admin','driver','passenger');
CREATE TYPE public.mobility_vehicle_kind AS ENUM('AUTO','MOTO');
CREATE TYPE public.mobility_service_kind AS ENUM('economico','confort','xl','moto_pasajero');
CREATE TYPE public.mobility_review_status AS ENUM('pending','approved','rejected','suspended');
CREATE TABLE public.user_roles(
 user_id uuid PRIMARY KEY,
 role public.app_role NOT NULL
);
CREATE TABLE public.ci_g282_sessions(
 user_id uuid NOT NULL,
 session_id uuid NOT NULL,
 issued_at bigint NOT NULL,
 is_active boolean NOT NULL,
 PRIMARY KEY(user_id,session_id)
);
-- Strict disposable replica of the G2 draft contract; no live vehicle table,
-- evidence review, genuine Driver, license, road or financial operations.
CREATE TABLE public.mobility_vehicle_applications(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 driver_id uuid NOT NULL,
 vehicle_kind public.mobility_vehicle_kind NOT NULL,
 service_kind public.mobility_service_kind NOT NULL,
 municipality_code text NOT NULL,
 plate_normalized text NOT NULL,
 brand text NOT NULL,
 model text NOT NULL,
 manufacture_year integer NOT NULL,
 passenger_capacity integer NOT NULL,
 status public.mobility_review_status NOT NULL DEFAULT 'pending',
 evidence_unverified boolean NOT NULL DEFAULT true
);
ALTER TABLE public.mobility_vehicle_applications ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.mobility_stage_g42_lock_session(
 _user uuid,_session uuid,_iat_ms bigint
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS(
  SELECT 1 FROM public.ci_g282_sessions s
  WHERE s.user_id=$1 AND s.session_id=$2 AND s.issued_at=$3
   AND s.is_active=true FOR SHARE
 )
$f$;
CREATE FUNCTION public.mobility_submit_vehicle_draft(
 _driver_id uuid,_request_key uuid,_kind public.mobility_vehicle_kind,
 _service public.mobility_service_kind,_municipality text,_plate text,
 _brand text,_model text,_year integer,_capacity integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE x uuid; prior public.mobility_vehicle_applications%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE
  r.user_id=_driver_id AND r.role IN ('passenger','driver'))
 THEN RAISE EXCEPTION 'Unregistered'; END IF;
 IF (_kind='MOTO' AND _service<>'moto_pasajero') OR
    (_kind='AUTO' AND _service='moto_pasajero')
 THEN RAISE EXCEPTION 'Kind mismatch'; END IF;
 INSERT INTO public.mobility_vehicle_applications(
 request_key,driver_id,vehicle_kind,service_kind,
 municipality_code,plate_normalized,brand,model,
 manufacture_year,passenger_capacity
 ) VALUES($2,$1,$3,$4,$5,$6,$7,$8,$9,$10)
 ON CONFLICT (request_key) DO NOTHING
 RETURNING id INTO x;
 IF x IS NOT NULL THEN RETURN x; END IF;
 SELECT * INTO prior FROM public.mobility_vehicle_applications WHERE request_key=$2;
 IF NOT FOUND OR prior.driver_id<>$1 OR
    prior.vehicle_kind<>$3 OR prior.service_kind<>$4 OR
    prior.municipality_code<>$5 OR prior.plate_normalized<>$6 OR
    prior.brand<>$7 OR prior.model<>$8 OR
    prior.manufacture_year<>$9 OR prior.passenger_capacity<>$10
 THEN RAISE EXCEPTION 'Conflicting idempotency'; END IF;
 RETURN prior.id;
END $f$;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000101','driver'),
 ('00000000-0000-4000-8000-000000000102','passenger');
INSERT INTO public.ci_g282_sessions(user_id,session_id,issued_at,is_active) VALUES
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201',1793400000000,true),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000202',1793400000000,true);
