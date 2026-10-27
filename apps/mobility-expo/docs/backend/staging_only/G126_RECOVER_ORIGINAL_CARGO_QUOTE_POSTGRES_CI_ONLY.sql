-- G126 read-after-lost-ACK: fetch original G7 cargo quote without re-billing a
-- road provider after a verified road attestation expires (while G7 still valid).
-- Only original sender/key/delivery; never returns a new amount or new booking.
-- PostgreSQL16 DISPOSABLE QA ONLY; no LIVE, no provider, no PSP.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g125_cargo_road_attestations') IS NULL
 OR to_regclass('public.mobility_stage_g124_delivery_tariff_policy') IS NULL
 THEN RAISE EXCEPTION 'G126 requires disposable G125, G124 and G7'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g126_recover_cargo_quote_qa(
 _sender uuid,_delivery uuid,_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_fare_quotes%ROWTYPE;
 d public.mobility_stage_deliveries%ROWTYPE;
 matched boolean:=false;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _sender IS NULL OR _delivery IS NULL OR _key IS NULL
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_sender)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_sender
  AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G126 passenger authorization required'
  USING ERRCODE='P1261'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
  WHERE id=_delivery AND sender_id=_sender FOR SHARE;
 IF NOT FOUND OR d.status<>'requested' OR d.courier_id IS NOT NULL
 OR d.requested_vehicle_kind NOT IN ('AUTO','MOTO')
 THEN RAISE EXCEPTION 'G126 original cargo is unavailable'
  USING ERRCODE='P1261'; END IF;
 SELECT * INTO q FROM public.mobility_stage_fare_quotes WHERE request_key=_key FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF q.customer_id<>_sender OR q.subject_kind<>'DELIVERY'
 OR q.mode<>'DELIVERY' OR q.subject_id<>_delivery
 OR q.expires_at<=pg_catalog.clock_timestamp()
 OR q.total_pyg<=0 OR q.provider_pyg+q.commission_pyg<>q.total_pyg
 THEN RAISE EXCEPTION 'G126 quote mismatch or expiry' USING ERRCODE='P1261'; END IF;
 SELECT true INTO matched
 FROM public.mobility_stage_g125_cargo_road_attestations e
 JOIN public.mobility_stage_fare_rules r ON r.id=q.rule_id
 JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa b
  ON b.rule_id=r.id AND b.vehicle_kind=d.requested_vehicle_kind
 WHERE e.delivery_id=d.id AND e.sender_id=d.sender_id
  AND e.vehicle_kind=d.requested_vehicle_kind
  AND e.rule_id=r.id AND e.zone_tag=r.zone_tag
  AND e.pickup_tag=d.pickup_tag AND e.delivery_tag=d.delivery_tag
  AND q.distance_meters=e.distance_meters
  AND q.duration_seconds=e.duration_seconds AND q.tolls_pyg=e.tolls_pyg
  AND r.mode='DELIVERY' AND r.valid_from<=q.quoted_at
  AND r.valid_until>q.quoted_at
  AND q.quoted_at>=e.verified_at AND q.quoted_at<=e.expires_at
  AND e.provider_status='INDEPENDENT_ROAD_ATTESTED_QA'
 FOR SHARE OF e,r,b;
 IF matched IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G126 quote missing original road and vehicle proof'
  USING ERRCODE='P1261'; END IF;
 RETURN q.id;
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g126_recover_cargo_quote_qa(
 uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g126_recover_cargo_quote_qa(
 uuid,uuid,uuid) TO service_role;
COMMIT;
