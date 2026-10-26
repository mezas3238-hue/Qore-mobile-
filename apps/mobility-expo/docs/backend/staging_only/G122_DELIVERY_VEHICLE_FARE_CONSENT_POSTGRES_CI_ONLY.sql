-- G122 delivery quote acceptance by original sender and actual cargo vehicle.
-- Disposable PG16 CI ONLY. No priced route provider, PSP, LIVE or legal GO.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_fare_quotes') IS NULL
 OR to_regclass('public.mobility_stage_deliveries') IS NULL
 THEN RAISE EXCEPTION 'G122 only on isolated PG16 after G5/G7'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g122_delivery_rate_vehicle_qa(
 rule_id uuid PRIMARY KEY REFERENCES public.mobility_stage_fare_rules(id) ON DELETE RESTRICT,
 vehicle_kind public.mobility_vehicle_kind NOT NULL,
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 bound_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE public.mobility_stage_g122_delivery_price_consents(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 confirmation_key uuid NOT NULL UNIQUE,
 delivery_id uuid NOT NULL UNIQUE
  REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 quote_id uuid NOT NULL UNIQUE
  REFERENCES public.mobility_stage_fare_quotes(id) ON DELETE RESTRICT,
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_kind public.mobility_vehicle_kind NOT NULL,
 accepted_total_gs integer NOT NULL CHECK(accepted_total_gs BETWEEN 1 AND 100000000),
 accepted_fare_version text NOT NULL CHECK(accepted_fare_version ~ '^[a-zA-Z0-9._-]{1,48}$'),
 confirmed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
ALTER TABLE public.mobility_stage_g122_delivery_rate_vehicle_qa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g122_delivery_price_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g122_delivery_rate_vehicle_qa
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g122_delivery_price_consents
 FROM PUBLIC,anon,authenticated,service_role;

-- Trusted SQL fixture only: the approved tariff rule is bound to ONE vehicle.
-- Not a public Owner-configuration endpoint. Unbound prices fail closed.
CREATE FUNCTION public.mobility_stage_g122_bind_delivery_tariff_qa(
 _admin uuid,_rule uuid,_vehicle public.mobility_vehicle_kind
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE r public.mobility_stage_fare_rules%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _admin IS NULL OR _rule IS NULL OR _vehicle NOT IN ('AUTO','MOTO')
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_admin)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_admin
  AND role='admin'::public.app_role)
 THEN RAISE EXCEPTION 'G122 approved Admin role required' USING ERRCODE='P1221'; END IF;
 SELECT * INTO r FROM public.mobility_stage_fare_rules WHERE id=_rule FOR SHARE;
 IF NOT FOUND OR r.mode<>'DELIVERY' OR r.active IS NOT TRUE
 OR r.valid_from>pg_catalog.clock_timestamp()
 OR r.valid_until<=pg_catalog.clock_timestamp()
 OR r.approved_by<>_admin
 THEN RAISE EXCEPTION 'G122 no approved delivery tariff' USING ERRCODE='P1221'; END IF;
 INSERT INTO public.mobility_stage_g122_delivery_rate_vehicle_qa(
  rule_id,vehicle_kind,approved_by) VALUES(_rule,_vehicle,_admin);
END $f$;

CREATE FUNCTION public.mobility_stage_g122_accept_delivery_quote_qa(
 _sender uuid,_delivery uuid,_quote uuid,_confirmation_key uuid,
 _accepted_total_gs integer,_accepted_fare_version text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 q public.mobility_stage_fare_quotes%ROWTYPE;
 r public.mobility_stage_fare_rules%ROWTYPE;
 bound_kind public.mobility_vehicle_kind;
 old public.mobility_stage_g122_delivery_price_consents%ROWTYPE;
 created public.mobility_stage_g122_delivery_price_consents%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _sender IS NULL OR _delivery IS NULL OR _quote IS NULL
 OR _confirmation_key IS NULL OR _accepted_total_gs NOT BETWEEN 1 AND 100000000
 OR _accepted_fare_version !~ '^[a-zA-Z0-9._-]{1,48}$'
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_sender)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_sender
  AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G122 sender or price consent invalid' USING ERRCODE='P1222'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
  WHERE id=_delivery AND sender_id=_sender FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G122 delivery unavailable' USING ERRCODE='P1222'; END IF;
 SELECT * INTO old FROM public.mobility_stage_g122_delivery_price_consents
  WHERE delivery_id=_delivery;
 IF FOUND THEN
  IF old.sender_id<>_sender OR old.quote_id<>_quote
  OR old.confirmation_key<>_confirmation_key
  OR old.accepted_total_gs<>_accepted_total_gs
  OR old.accepted_fare_version<>_accepted_fare_version
  THEN RAISE EXCEPTION 'G122 immutable consent replay mismatch' USING ERRCODE='P1222'; END IF;
  RETURN pg_catalog.jsonb_build_object(
   'consentId',old.id,'deliveryId',old.delivery_id,'quoteId',old.quote_id,
   'confirmationKey',old.confirmation_key,'vehicleKind',old.vehicle_kind,
   'acceptedTotalGs',old.accepted_total_gs,'fareVersion',old.accepted_fare_version,
   'status','confirmed_qa','serverPersisted',true,'liveEnabled',false);
 END IF;
 IF d.status<>'requested' OR d.courier_id IS NOT NULL
 THEN RAISE EXCEPTION 'G122 delivery no longer priceable' USING ERRCODE='P1222'; END IF;
 SELECT * INTO q FROM public.mobility_stage_fare_quotes WHERE id=_quote FOR SHARE;
 IF NOT FOUND OR q.customer_id<>_sender OR q.subject_kind<>'DELIVERY'
 OR q.mode<>'DELIVERY' OR q.subject_id<>_delivery
 OR q.expires_at<=pg_catalog.clock_timestamp()
 OR q.total_pyg<>_accepted_total_gs OR q.total_pyg<=0
 OR q.provider_pyg+q.commission_pyg<>q.total_pyg
 THEN RAISE EXCEPTION 'G122 quote mismatched, absent or expired' USING ERRCODE='P1222'; END IF;
 SELECT * INTO r FROM public.mobility_stage_fare_rules WHERE id=q.rule_id;
 SELECT vehicle_kind INTO bound_kind FROM public.mobility_stage_g122_delivery_rate_vehicle_qa
  WHERE rule_id=q.rule_id;
 IF NOT FOUND OR bound_kind IS DISTINCT FROM d.requested_vehicle_kind
 OR r.rule_key IS DISTINCT FROM _accepted_fare_version
 THEN RAISE EXCEPTION 'G122 unbound tariff or vehicle mismatch' USING ERRCODE='P1222'; END IF;
 INSERT INTO public.mobility_stage_g122_delivery_price_consents(
  confirmation_key,delivery_id,quote_id,sender_id,vehicle_kind,
  accepted_total_gs,accepted_fare_version)
 VALUES(_confirmation_key,_delivery,_quote,_sender,d.requested_vehicle_kind,
  q.total_pyg,r.rule_key) RETURNING * INTO created;
 RETURN pg_catalog.jsonb_build_object(
  'consentId',created.id,'deliveryId',created.delivery_id,'quoteId',created.quote_id,
  'confirmationKey',created.confirmation_key,'vehicleKind',created.vehicle_kind,
  'acceptedTotalGs',created.accepted_total_gs,'fareVersion',created.accepted_fare_version,
  'status','confirmed_qa','serverPersisted',true,'liveEnabled',false);
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g122_bind_delivery_tariff_qa(
 uuid,uuid,public.mobility_vehicle_kind) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g122_accept_delivery_quote_qa(
 uuid,uuid,uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g122_accept_delivery_quote_qa(
 uuid,uuid,uuid,uuid,integer,text) TO service_role;
COMMIT;
