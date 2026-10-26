-- G123: prevent any private MOTO/AUTO delivery offer or assignment until
-- the ORIGINAL sender has explicitly accepted the matching G7 immutable fare.
-- CI-only disposable PostgreSQL16. Does NOT mint legal Driver authorization.
DO $gate$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g122_delivery_price_consents') IS NULL
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'G123 requires disposable G71/G122 chain'; END IF;
END $gate$;
BEGIN;

-- This read-only helper is callable exclusively by SQL owner wrappers/triggers;
-- it locks fare rows so consent/quote cannot change between check and mutation.
CREATE FUNCTION public.mobility_stage_g123_delivery_priced_qa(_delivery uuid)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF _delivery IS NULL THEN RETURN false; END IF;
 PERFORM 1
 FROM public.mobility_stage_deliveries d
 JOIN public.mobility_stage_g122_delivery_price_consents c
  ON c.delivery_id=d.id AND c.sender_id=d.sender_id
  AND c.vehicle_kind=d.requested_vehicle_kind
 JOIN public.mobility_stage_fare_quotes q
  ON q.id=c.quote_id AND q.customer_id=d.sender_id
  AND q.subject_kind='DELIVERY' AND q.mode='DELIVERY'
  AND q.subject_id=d.id AND q.total_pyg=c.accepted_total_gs
  AND q.total_pyg>0 AND q.commission_pyg+q.provider_pyg=q.total_pyg
 JOIN public.mobility_stage_fare_rules r
  ON r.id=q.rule_id AND r.mode='DELIVERY'
  AND r.rule_key=c.accepted_fare_version
 JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa bound
  ON bound.rule_id=q.rule_id
  AND bound.vehicle_kind=d.requested_vehicle_kind
 JOIN public.user_roles sender
  ON sender.user_id=d.sender_id AND sender.role='passenger'::public.app_role
 WHERE d.id=_delivery AND d.status='requested'
  AND d.courier_id IS NULL AND d.vehicle_id IS NULL
  AND d.proof_ref IS NULL
  AND d.requested_vehicle_kind IN ('AUTO','MOTO')
  AND (SELECT count(*) FROM public.user_roles u WHERE u.user_id=d.sender_id)=1
  AND c.accepted_total_gs BETWEEN 1 AND 100000000
  AND c.confirmed_at<=pg_catalog.clock_timestamp()
  AND q.quoted_at<=c.confirmed_at
  AND q.expires_at>pg_catalog.clock_timestamp()
  -- Owner version changes never reprice an already accepted, unexpired quote.
  AND r.valid_from<=q.quoted_at
  AND r.valid_until>q.quoted_at
 FOR SHARE OF d,c,q,r,bound,sender;
 RETURN FOUND;
END $f$;

-- SQL DML fence applies to old G10 core, G71 wrapper, new offers and
-- direct assignment attempts. A handwritten service-role DML write is still
-- impossible because G37 revoked DML and the raw SQL cores are inaccessible.
CREATE FUNCTION public.mobility_stage_g123_cargo_offer_insert_fence()
 RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF TG_OP<>'INSERT' OR TG_TABLE_NAME<>'mobility_stage_delivery_offers'
 OR NOT public.mobility_stage_g123_delivery_priced_qa(NEW.delivery_id)
 THEN RAISE EXCEPTION 'G123 delivery fare consent required before offer'
  USING ERRCODE='P1231'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER b10_g123_private_delivery_price
 BEFORE INSERT ON public.mobility_stage_delivery_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g123_cargo_offer_insert_fence();

CREATE FUNCTION public.mobility_stage_g123_cargo_assignment_fence()
 RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_NAME<>'mobility_stage_deliveries'
 THEN RAISE EXCEPTION 'G123 unexpected assignment mutation'
  USING ERRCODE='P1231'; END IF;
 IF NEW.status='accepted' AND
  (OLD.status='requested' OR NEW.courier_id IS DISTINCT FROM OLD.courier_id
   OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id) AND
  NOT public.mobility_stage_g123_delivery_priced_qa(NEW.id)
 THEN RAISE EXCEPTION 'G123 delivery fare consent required for assignment'
  USING ERRCODE='P1231'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER b10_g123_delivery_assignment_price
 BEFORE UPDATE OF status,courier_id,vehicle_id ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g123_cargo_assignment_fence();

-- Upgrade public G71 wrappers without replacing/reopening old KYC or G38
-- verification. Preserve the single public RPC names consumed by Driver C.
ALTER FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)
 RENAME TO mobility_stage_g123_previous_delivery_offer_qa;
ALTER FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)
 RENAME TO mobility_stage_g123_previous_delivery_accept_qa;

CREATE FUNCTION public.mobility_stage_delivery_offer(
 _delivery uuid,_courier uuid,_vehicle uuid,_request uuid,_ttl integer)
 RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
BEGIN
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery FOR UPDATE;
 IF NOT FOUND OR NOT public.mobility_stage_g123_delivery_priced_qa(_delivery)
 THEN RAISE EXCEPTION 'G123 price must be confirmed before Driver offer'
  USING ERRCODE='P1231'; END IF;
 -- G71 validates KYC and G38 remains the independent legal acceptance veto.
 RETURN public.mobility_stage_g123_previous_delivery_offer_qa(
  _delivery,_courier,_vehicle,_request,_ttl);
END $f$;

CREATE FUNCTION public.mobility_stage_delivery_accept_offer(
 _offer uuid,_courier uuid,_decision uuid)
 RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE offered public.mobility_stage_delivery_offers%ROWTYPE;
 d public.mobility_stage_deliveries%ROWTYPE;
BEGIN
 SELECT * INTO offered FROM public.mobility_stage_delivery_offers
 WHERE id=_offer AND courier_id=_courier;
 IF NOT FOUND THEN RAISE EXCEPTION 'G123 private offer or courier unknown'
  USING ERRCODE='P1231'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=offered.delivery_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G123 delivery missing'
  USING ERRCODE='P1231'; END IF;

 -- An already accepted offer can be RECONCILED by the exact original key.
 -- This never starts another assignment, never bypasses the existing G71
 -- KYC verification, and checks original fare CONSENT even if the quote
 -- expired AFTER the legitimately accepted offer.
 IF offered.status='accepted' AND offered.decision_key=_decision
  AND offered.decision_event_id IS NOT NULL
  AND d.courier_id=_courier AND d.vehicle_id=offered.vehicle_id
  AND d.status IN ('accepted','picked_up','delivered','disputed','returned')
 THEN
  PERFORM 1 FROM public.mobility_stage_g122_delivery_price_consents c
  JOIN public.mobility_stage_fare_quotes q
   ON q.id=c.quote_id AND q.subject_id=d.id AND q.customer_id=d.sender_id
   AND q.subject_kind='DELIVERY' AND q.mode='DELIVERY'
   AND q.total_pyg=c.accepted_total_gs
  JOIN public.mobility_stage_fare_rules r
   ON r.id=q.rule_id AND r.rule_key=c.accepted_fare_version
  JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa bind
   ON bind.rule_id=q.rule_id AND bind.vehicle_kind=d.requested_vehicle_kind
  WHERE c.delivery_id=d.id AND c.sender_id=d.sender_id
   AND c.vehicle_kind=d.requested_vehicle_kind
   AND c.confirmed_at<=offered.offered_at
  FOR SHARE OF c,q,r,bind;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'G123 old accepted offer lacks original price consent'
    USING ERRCODE='P1231'; END IF;
  -- G71 and G10 own all role/KYC and accepted-event replay validation.
  RETURN public.mobility_stage_g123_previous_delivery_accept_qa(
   _offer,_courier,_decision);
 END IF;
 -- First accept (including forged/stale offer) must still require an
 -- unexpired consented quote and the existing legal/KYC gates.
 IF NOT public.mobility_stage_g123_delivery_priced_qa(d.id)
 THEN RAISE EXCEPTION 'G123 original delivery fare consent unavailable'
  USING ERRCODE='P1231'; END IF;
 RETURN public.mobility_stage_g123_previous_delivery_accept_qa(
  _offer,_courier,_decision);
END $f$;

REVOKE ALL ON FUNCTION public.mobility_stage_g123_delivery_priced_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g123_cargo_offer_insert_fence()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g123_cargo_assignment_fence()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g123_previous_delivery_offer_qa(
 uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g123_previous_delivery_accept_qa(
 uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_offer(
 uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_accept_offer(
 uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_offer(
 uuid,uuid,uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_accept_offer(
 uuid,uuid,uuid) TO service_role;
COMMIT;
