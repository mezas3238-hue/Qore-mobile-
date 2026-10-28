-- G124 Owner-only independent cargo tariffs for AUTO/MOTO (NO ride commission edits).
-- POSTGRESQL16 DISPOSABLE CI ONLY. No remote SQL, PSP or route attestation.
DO $gate$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g122_delivery_rate_vehicle_qa') IS NULL
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G124 refuses remote or incomplete PG16'; END IF;
END $gate$;
BEGIN;
CREATE TABLE public.mobility_stage_g124_delivery_tariff_policy(
 vehicle_kind public.mobility_vehicle_kind NOT NULL CHECK(vehicle_kind IN ('AUTO','MOTO')),
 cargo_zone text NOT NULL CHECK(cargo_zone ~ '^[A-Z_]{3,20}$'),
 current_rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id),
 version integer NOT NULL CHECK(version>0),
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 changed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(vehicle_kind,cargo_zone)
);
CREATE TABLE public.mobility_stage_g124_delivery_tariff_audit(
 request_key uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 vehicle_kind public.mobility_vehicle_kind NOT NULL,
 cargo_zone text NOT NULL,
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id),
 version integer NOT NULL CHECK(version>0),
 base_pyg integer NOT NULL,
 per_km_pyg integer NOT NULL,
 per_minute_pyg integer NOT NULL,
 minimum_pyg integer NOT NULL,
 commission_bps integer NOT NULL,
 duration_days integer NOT NULL,
 receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
ALTER TABLE public.mobility_stage_g124_delivery_tariff_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g124_delivery_tariff_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g124_delivery_tariff_policy FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g124_delivery_tariff_audit FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g124_owner_rate_read_qa(
 _owner uuid,_vehicle text,_zone text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE policy public.mobility_stage_g124_delivery_tariff_policy%ROWTYPE;
 rule public.mobility_stage_fare_rules%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _owner IS NULL OR _vehicle NOT IN ('AUTO','MOTO')
 OR _zone !~ '^[A-Z_]{3,20}$'
 OR public.mobility_stage_g27_backoffice_role_of(_owner) IS DISTINCT FROM 'owner'
 THEN RAISE EXCEPTION 'G124 exclusive Owner required' USING ERRCODE='P1241'; END IF;
 SELECT * INTO policy FROM public.mobility_stage_g124_delivery_tariff_policy
 WHERE vehicle_kind=_vehicle::public.mobility_vehicle_kind AND cargo_zone=_zone;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO rule FROM public.mobility_stage_fare_rules WHERE id=policy.current_rule_id;
 IF NOT FOUND OR rule.mode<>'DELIVERY' OR
  rule.zone_tag IS DISTINCT FROM (_vehicle||'_'||_zone)
 THEN RAISE EXCEPTION 'G124 tariff pointer invalid' USING ERRCODE='P1241'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'vehicleKind',_vehicle,'cargoZone',_zone,'ruleId',rule.id,
  'ruleVersion',rule.rule_key,'version',policy.version,
  'basePyg',rule.base_pyg,'perKmPyg',rule.per_km_pyg,
  'perMinutePyg',rule.per_minute_pyg,'minimumPyg',rule.minimum_pyg,
  'commissionBps',rule.commission_bps,'active',rule.active,
  'validUntil',rule.valid_until,'mode','STAGING_DEMO_ONLY',
  'liveEnabled',false,'passengerSubsidyPolicyApplicable',false);
END $f$;

CREATE FUNCTION public.mobility_stage_g124_owner_rate_set_qa(
 _owner uuid,_request uuid,_vehicle text,_zone text,
 _base integer,_per_km integer,_per_minute integer,_minimum integer,
 _commission integer,_days integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE old public.mobility_stage_g124_delivery_tariff_policy%ROWTYPE;
 old_rule public.mobility_stage_fare_rules%ROWTYPE;
 prior public.mobility_stage_g124_delivery_tariff_audit%ROWTYPE;
 next_version integer; new_rule uuid; version_key text;
 result jsonb; now_at timestamptz;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _owner IS NULL OR _request IS NULL OR _vehicle NOT IN ('AUTO','MOTO')
 OR _zone !~ '^[A-Z_]{3,20}$'
 OR _base NOT BETWEEN 0 AND 1000000
 OR _per_km NOT BETWEEN 0 AND 100000
 OR _per_minute NOT BETWEEN 0 AND 20000
 OR _minimum NOT BETWEEN 1 AND 1000000
 OR _commission NOT BETWEEN 0 AND 3000
 OR _days NOT BETWEEN 1 AND 90
 OR public.mobility_stage_g27_backoffice_role_of(_owner) IS DISTINCT FROM 'owner'
 THEN RAISE EXCEPTION 'G124 invalid Owner cargo tariff command' USING ERRCODE='P1241'; END IF;
 -- Lock by the exact independent cargo category and zone; no two writers race.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'G124:'||_vehicle||':'||_zone,0));
 SELECT * INTO prior FROM public.mobility_stage_g124_delivery_tariff_audit
 WHERE request_key=_request;
 IF FOUND THEN
  IF prior.owner_id<>_owner OR prior.vehicle_kind::text<>_vehicle
   OR prior.cargo_zone<>_zone OR prior.base_pyg<>_base OR prior.per_km_pyg<>_per_km
   OR prior.per_minute_pyg<>_per_minute OR prior.minimum_pyg<>_minimum
   OR prior.commission_bps<>_commission OR prior.duration_days<>_days
  THEN RAISE EXCEPTION 'G124 contradictory idempotency key' USING ERRCODE='P1241'; END IF;
  RETURN prior.receipt; -- Stable historic receipt, even after later changes.
 END IF;
 SELECT * INTO old FROM public.mobility_stage_g124_delivery_tariff_policy
  WHERE vehicle_kind=_vehicle::public.mobility_vehicle_kind
   AND cargo_zone=_zone FOR UPDATE;
 next_version:=CASE WHEN FOUND THEN old.version+1 ELSE 1 END;
 IF old.current_rule_id IS NOT NULL THEN
  SELECT * INTO old_rule FROM public.mobility_stage_fare_rules
   WHERE id=old.current_rule_id FOR UPDATE;
  IF old_rule.base_pyg=_base AND old_rule.per_km_pyg=_per_km
   AND old_rule.per_minute_pyg=_per_minute AND old_rule.minimum_pyg=_minimum
   AND old_rule.commission_bps=_commission
  THEN RAISE EXCEPTION 'G124 unchanged tariff does not need a new revision'
   USING ERRCODE='P1241'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.mobility_stage_fare_rules
   WHERE mode='DELIVERY' AND zone_tag=_vehicle||'_'||_zone AND active)
  THEN RAISE EXCEPTION 'G124 cannot override unowned active delivery tariff'
   USING ERRCODE='P1241'; END IF;
 END IF;
 now_at:=pg_catalog.clock_timestamp();
 version_key:='cargo_'||pg_catalog.lower(_vehicle)||'_'||
  pg_catalog.lower(_zone)||'_v'||next_version;
 IF pg_catalog.length(version_key)>48 THEN
  RAISE EXCEPTION 'G124 rule version too long' USING ERRCODE='P1241'; END IF;
 IF old.current_rule_id IS NOT NULL THEN
  UPDATE public.mobility_stage_fare_rules SET active=false WHERE id=old.current_rule_id;
 END IF;
 INSERT INTO public.mobility_stage_fare_rules(
  rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,
  minimum_pyg,commission_bps,valid_from,valid_until,active,approved_by,approved_at)
 VALUES(version_key,'DELIVERY',_vehicle||'_'||_zone,
  _base,_per_km,_per_minute,_minimum,_commission,
  now_at,now_at+pg_catalog.make_interval(days=>_days),true,_owner,now_at)
 RETURNING id INTO new_rule;
 INSERT INTO public.mobility_stage_g122_delivery_rate_vehicle_qa(
  rule_id,vehicle_kind,approved_by)
 VALUES(new_rule,_vehicle::public.mobility_vehicle_kind,_owner);
 INSERT INTO public.mobility_stage_g124_delivery_tariff_policy(
  vehicle_kind,cargo_zone,current_rule_id,version,changed_by)
 VALUES(_vehicle::public.mobility_vehicle_kind,_zone,new_rule,next_version,_owner)
 ON CONFLICT(vehicle_kind,cargo_zone) DO UPDATE
 SET current_rule_id=EXCLUDED.current_rule_id,version=EXCLUDED.version,
  changed_by=EXCLUDED.changed_by,changed_at=pg_catalog.clock_timestamp();
 result:=public.mobility_stage_g124_owner_rate_read_qa(_owner,_vehicle,_zone);
 INSERT INTO public.mobility_stage_g124_delivery_tariff_audit(
  request_key,owner_id,vehicle_kind,cargo_zone,rule_id,version,
  base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,commission_bps,
  duration_days,receipt)
 VALUES(_request,_owner,_vehicle::public.mobility_vehicle_kind,_zone,new_rule,
  next_version,_base,_per_km,_per_minute,_minimum,_commission,_days,result);
 RETURN result;
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g124_owner_rate_read_qa(uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g124_owner_rate_set_qa(
 uuid,uuid,text,text,integer,integer,integer,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g124_owner_rate_read_qa(uuid,text,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g124_owner_rate_set_qa(
 uuid,uuid,text,text,integer,integer,integer,integer,integer,integer)
 TO service_role;
COMMIT;
