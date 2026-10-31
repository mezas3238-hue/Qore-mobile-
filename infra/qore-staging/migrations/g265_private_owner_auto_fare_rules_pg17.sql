-- G265: Supabase STAGING PostgreSQL 17 owner-controlled AUTO fare publication.
-- Code-first / non-commercial / NO PSP. No synthetic Owner or AAL2 approval.
-- Install only after review + disposable PG16/PG17 CI. Requires G262 G73.
DO $prereq$ BEGIN
 IF to_regclass('public.mobility_stage_fare_rules') IS NULL
 OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 OR to_regclass('auth.sessions') IS NULL
 OR to_regprocedure('public.mobility_stage_g42_session_active(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_g73_quote(uuid,uuid,uuid)') IS NULL
 OR to_regnamespace('qore_stage_internal') IS NULL
 THEN RAISE EXCEPTION 'G265 STAGING Owner/G42/G73 prerequisites absent'; END IF;
END $prereq$;

-- Private implementation. Caller is the server-only service_role through
-- authenticated provider session, plus independently approved Owner and MFA.
CREATE FUNCTION qore_stage_internal.mobility_stage_g265_publish_auto_fare(
 _owner uuid, _session uuid, _iat_ms bigint, _request_key uuid,
 _zone_tag text, _base_pyg integer, _per_km_pyg integer,
 _per_minute_pyg integer, _minimum_pyg integer, _commission_bps integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 existing public.mobility_stage_fare_rules%ROWTYPE;
 fresh public.mobility_stage_fare_rules%ROWTYPE;
 new_rule_key text;
 stamp timestamptz;
BEGIN
 IF _owner IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _request_key IS NULL OR _zone_tag IS NULL
 OR _zone_tag !~ '^[A-Z_]{3,40}$'
 OR _base_pyg IS NULL OR _base_pyg NOT BETWEEN 1000 AND 1000000
 OR _per_km_pyg IS NULL OR _per_km_pyg NOT BETWEEN 0 AND 100000
 OR _per_minute_pyg IS NULL OR _per_minute_pyg NOT BETWEEN 0 AND 20000
 OR _minimum_pyg IS NULL OR _minimum_pyg NOT BETWEEN 1000 AND 1000000
 OR _commission_bps IS NULL OR _commission_bps NOT BETWEEN 0 AND 3000
 THEN RAISE EXCEPTION 'G265 invalid owner-fare parameters' USING ERRCODE='P2651'; END IF;
 -- G42 uses provider-backed auth.sessions and tests both session ownership
 -- and issued-at freshness. The session MUST be actual MFA AAL2.
 IF public.mobility_stage_g42_session_active(_owner,_session,_iat_ms) IS DISTINCT FROM true
 OR NOT EXISTS(SELECT 1 FROM auth.sessions s
   WHERE s.id=_session AND s.user_id=_owner AND s.aal='aal2')
 THEN RAISE EXCEPTION 'G265 real Owner MFA session required' USING ERRCODE='P2652'; END IF;
 -- G27 independent approver and *no* native role; no self-promotion.
 IF NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_backoffice_roles b
   WHERE b.user_id=_owner AND b.role='owner' AND b.status='active'
     AND b.approved_by<>b.user_id
     AND NOT EXISTS(SELECT 1 FROM public.user_roles nr WHERE nr.user_id=b.user_id)
 ) THEN RAISE EXCEPTION 'G265 independently approved Owner required' USING ERRCODE='P2652'; END IF;
 -- Serialize all publications in a zone; no overlapping active rules.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('QORE_G265_AUTO_FARE:'||_zone_tag,265));
 new_rule_key:='G265_'||replace(_request_key::text,'-','');
 SELECT * INTO existing FROM public.mobility_stage_fare_rules fr
 WHERE fr.rule_key=new_rule_key FOR UPDATE;
 IF FOUND THEN
  IF existing.mode<>'AUTO'::public.mobility_stage_fare_mode
   OR existing.zone_tag<>_zone_tag OR existing.approved_by<>_owner
   OR existing.base_pyg<>_base_pyg OR existing.per_km_pyg<>_per_km_pyg
   OR existing.per_minute_pyg<>_per_minute_pyg
   OR existing.minimum_pyg<>_minimum_pyg
   OR existing.commission_bps<>_commission_bps
  THEN RAISE EXCEPTION 'G265 conflicting fare publication key' USING ERRCODE='P2653'; END IF;
  RETURN pg_catalog.jsonb_build_object(
   'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
   'ruleKey',existing.rule_key,'zoneTag',existing.zone_tag,
   'commissionBps',existing.commission_bps,'commissionPercent',existing.commission_bps/100.0,
   'active',existing.active,'idempotent',true);
 END IF;
 -- Disallow active quotes from a different rule turning into mutable fare.
 -- All prequotes freeze rule_id and total_pyg, so history is preserved.
 UPDATE public.mobility_stage_fare_rules
 SET active=false WHERE mode='AUTO'::public.mobility_stage_fare_mode
  AND zone_tag=_zone_tag AND active=true;
 stamp:=pg_catalog.clock_timestamp();
 INSERT INTO public.mobility_stage_fare_rules(
  rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,
  minimum_pyg,commission_bps,valid_from,valid_until,active,
  approved_by,approved_at
 ) VALUES(
  new_rule_key,'AUTO'::public.mobility_stage_fare_mode,_zone_tag,
  _base_pyg,_per_km_pyg,_per_minute_pyg,
  _minimum_pyg,_commission_bps,stamp,stamp+interval '30 days',true,
  _owner,stamp
 ) RETURNING * INTO fresh;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ruleKey',fresh.rule_key,'zoneTag',fresh.zone_tag,
  'commissionBps',fresh.commission_bps,'commissionPercent',fresh.commission_bps/100.0,
  'active',fresh.active,'idempotent',false);
END $fn$;

CREATE FUNCTION public.mobility_stage_g265_publish_auto_fare(
 _owner uuid, _session uuid, _iat_ms bigint, _request_key uuid,
 _zone_tag text, _base_pyg integer, _per_km_pyg integer,
 _per_minute_pyg integer, _minimum_pyg integer, _commission_bps integer
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT qore_stage_internal.mobility_stage_g265_publish_auto_fare(
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10);
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g265_publish_auto_fare(
 uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_g265_publish_auto_fare(
 uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g265_publish_auto_fare(
 uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_g265_publish_auto_fare(
 uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)
 TO service_role;
