-- G136 Owner commission policies for five independent services (QA only).
-- Disposable PostgreSQL16 CI ONLY; NEVER deploy to remote/production.
-- Passenger subsidy remains 1000 bps; cargo/commerce NEVER get a ride subsidy.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G116 requires disposable Owner registry'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g116_commission_policy(
 service_kind text PRIMARY KEY CHECK(service_kind IN ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 3000),
 CHECK(service_kind NOT IN ('AUTO_RIDE','MOTO_RIDE') OR commission_bps>=1000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 changed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE public.mobility_stage_g116_commission_audit(
 request_key uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 service_kind text NOT NULL REFERENCES public.mobility_stage_g116_commission_policy(service_kind),
 old_bps integer NOT NULL CHECK(old_bps BETWEEN 0 AND 3000),
 new_bps integer NOT NULL CHECK(new_bps BETWEEN 0 AND 3000),
 CHECK(service_kind NOT IN ('AUTO_RIDE','MOTO_RIDE') OR (old_bps>=1000 AND new_bps>=1000)),
 old_version integer NOT NULL CHECK(old_version>0),
 new_version integer NOT NULL CHECK(new_version=old_version+1),
 changed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
INSERT INTO public.mobility_stage_g116_commission_policy(service_kind,commission_bps)
VALUES ('AUTO_RIDE',1500),('MOTO_RIDE',1200),
 ('DELIVERY_AUTO',0),('DELIVERY_MOTO',0),('COMMERCE',0);
ALTER TABLE public.mobility_stage_g116_commission_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g116_commission_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g116_commission_policy
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g116_commission_audit
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mobility_stage_g116_read_commission_qa(_service text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT pg_catalog.jsonb_build_object(
 'serviceKind',p.service_kind,'commissionBps',p.commission_bps,
 'subsidyBps',CASE WHEN p.service_kind IN ('AUTO_RIDE','MOTO_RIDE')
 THEN 1000 ELSE 0 END,'version',p.version,
 'mode','STAGING_DEMO_ONLY','productionEnabled',false)
 FROM public.mobility_stage_g116_commission_policy p
 WHERE p.service_kind=_service
$fn$;
CREATE FUNCTION public.mobility_stage_g116_set_commission_qa(
 _owner uuid,_service text,_commission_bps integer,_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE p public.mobility_stage_g116_commission_policy%ROWTYPE;
 previous public.mobility_stage_g116_commission_audit%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _owner IS NULL OR _request_key IS NULL
 OR _service NOT IN ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')
 OR _commission_bps NOT BETWEEN 0 AND 3000
 OR (_service IN ('AUTO_RIDE','MOTO_RIDE') AND _commission_bps<1000)
 OR public.mobility_stage_g27_backoffice_role_of(_owner) IS DISTINCT FROM 'owner'
 THEN RAISE EXCEPTION 'G116 unauthorized or unsupported commission'
  USING ERRCODE='P1161'; END IF;
 -- HTTP gateway MUST obtain _owner from verified Owner JWT/MFA.
 -- Never pass a browser-supplied ID to this server-only RPC.
 SELECT * INTO previous FROM public.mobility_stage_g116_commission_audit
 WHERE request_key=_request_key;
 IF FOUND THEN
  IF previous.owner_id<>_owner OR previous.service_kind<>_service
   OR previous.new_bps<>_commission_bps
  THEN RAISE EXCEPTION 'G116 conflicting replay'
   USING ERRCODE='P1161'; END IF;
  RETURN pg_catalog.jsonb_build_object(
   'serviceKind',previous.service_kind,'commissionBps',previous.new_bps,
   'subsidyBps',CASE WHEN previous.service_kind IN ('AUTO_RIDE','MOTO_RIDE')
 THEN 1000 ELSE 0 END,'version',previous.new_version,
   'mode','STAGING_DEMO_ONLY','productionEnabled',false);
 END IF;
 SELECT * INTO p FROM public.mobility_stage_g116_commission_policy
 WHERE service_kind=_service FOR UPDATE;
 IF NOT FOUND OR p.commission_bps=_commission_bps
 THEN RAISE EXCEPTION 'G116 no commission change needed'
  USING ERRCODE='P1161'; END IF;
 UPDATE public.mobility_stage_g116_commission_policy
 SET commission_bps=_commission_bps,version=p.version+1,changed_by=_owner,
 changed_at=pg_catalog.clock_timestamp() WHERE service_kind=_service;
 INSERT INTO public.mobility_stage_g116_commission_audit(
 request_key,owner_id,service_kind,old_bps,new_bps,old_version,new_version)
 VALUES(_request_key,_owner,_service,p.commission_bps,_commission_bps,
 p.version,p.version+1);
 RETURN public.mobility_stage_g116_read_commission_qa(_service);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g116_read_commission_qa(text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g116_set_commission_qa(uuid,text,integer,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g116_read_commission_qa(text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g116_set_commission_qa(uuid,text,integer,uuid)
 TO service_role;
COMMIT;
