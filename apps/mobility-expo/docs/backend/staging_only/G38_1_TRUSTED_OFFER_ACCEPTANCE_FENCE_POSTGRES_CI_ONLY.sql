-- G38.1 — first transactional acceptance fence for trusted, specific
-- offers. G31 synthetic zones have eligible_by_policy=false by CHECK, so
-- this ALWAYS refuses live dispatch. No fake GPS or fabricated legal zone.
-- Real rollout requires independently certified proof issuer and geometry.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g31_zone_coverage') IS NULL
 OR to_regclass('public.mobility_stage_g32_signal_state') IS NULL
 OR to_regprocedure('public.mobility_stage_g37_state_integrity()') IS NULL
 THEN RAISE EXCEPTION 'G38.1 refuses non-disposable or missing source'; END IF;
END $guard$;
BEGIN;
-- This is only an immutable, private proof SLOT contract for the future
-- server-side geofence/Auth engine. No writer exists in this QA branch.
CREATE TABLE public.mobility_stage_g38_trusted_offer_proofs(
 offer_id uuid PRIMARY KEY,
 job_kind text NOT NULL CHECK(job_kind IN ('AUTO_RIDE','DELIVERY')),
 job_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 vehicle_id uuid NOT NULL,
 zone_id uuid NOT NULL,
 service_kind text NOT NULL CHECK(service_kind IN
  ('AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY')),
 consent_revision bigint NOT NULL CHECK(consent_revision>0),
 geometry_revision bigint NOT NULL CHECK(geometry_revision>0),
 policy_revision bigint NOT NULL CHECK(policy_revision>0),
 issuer_kind text NOT NULL CHECK(issuer_kind='CERTIFIED_REAL_SERVER_AUTH_AND_GEOFENCE'),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 CHECK(expires_at>issued_at),
 UNIQUE(job_kind,job_id,offer_id)
);
ALTER TABLE public.mobility_stage_g38_trusted_offer_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g38_trusted_offer_proofs
 FROM PUBLIC,anon,authenticated,service_role;
-- QA owner can seed counterfeit proof, but policy remains false;
-- this is deliberate to prove proofs alone cannot unlock dispatch.
CREATE FUNCTION public.mobility_stage_g38_acceptance_fence()
 RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=''
AS $body$
DECLARE
 kind text;
 service text;
 actor uuid;
 vehicle uuid;
 proof public.mobility_stage_g38_trusted_offer_proofs%ROWTYPE;
 consent_ok boolean:=false;
 signal_ok boolean:=false;
 docs_ok boolean:=false;
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public'
  OR TG_TABLE_NAME NOT IN('mobility_stage_auto_demo_trips','mobility_stage_deliveries')
 THEN RAISE EXCEPTION 'G38 unexpected acceptance trigger' USING ERRCODE='G3801'; END IF;
 IF NEW.status::text<>'accepted' OR OLD.status::text NOT IN('searching','requested')
 THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='mobility_stage_auto_demo_trips' THEN
  kind:='AUTO_RIDE';service:='AUTO_RIDE';
  actor:=NEW.driver_id;vehicle:=NEW.vehicle_id;
  SELECT p.* INTO proof
  FROM public.mobility_stage_g38_trusted_offer_proofs p
  JOIN public.mobility_stage_auto_demo_offers o ON o.id=p.offer_id
  WHERE p.job_kind=kind AND p.service_kind=service
   AND p.job_id=NEW.id AND p.driver_id=actor AND p.vehicle_id=vehicle
   AND o.trip_id=NEW.id AND o.driver_id=actor AND o.vehicle_id=vehicle
   AND o.status='offered' AND o.expires_at>pg_catalog.clock_timestamp()
   AND p.issued_at<=pg_catalog.clock_timestamp()
   AND p.expires_at>pg_catalog.clock_timestamp()
  FOR SHARE OF p,o;
 ELSE
  kind:='DELIVERY';
  service:=CASE NEW.requested_vehicle_kind::text WHEN 'AUTO'
   THEN 'AUTO_DELIVERY' WHEN 'MOTO' THEN 'MOTO_DELIVERY' ELSE NULL END;
  actor:=NEW.courier_id;vehicle:=NEW.vehicle_id;
  SELECT p.* INTO proof
  FROM public.mobility_stage_g38_trusted_offer_proofs p
  JOIN public.mobility_stage_delivery_offers o ON o.id=p.offer_id
  WHERE p.job_kind=kind AND p.service_kind=service
   AND p.job_id=NEW.id AND p.driver_id=actor AND p.vehicle_id=vehicle
   AND o.delivery_id=NEW.id AND o.courier_id=actor AND o.vehicle_id=vehicle
   AND o.status='offered' AND o.expires_at>pg_catalog.clock_timestamp()
   AND p.issued_at<=pg_catalog.clock_timestamp()
   AND p.expires_at>pg_catalog.clock_timestamp()
  FOR SHARE OF p,o;
 END IF;
 IF NOT FOUND OR proof.offer_id IS NULL
 THEN RAISE EXCEPTION 'G38 trusted bound offer proof absent'
  USING ERRCODE='G3801'; END IF;
 -- Authoritative location consent row is locked before accepting;
 -- concurrent revocation must wait or precede this transaction.
 PERFORM 1 FROM public.mobility_location_consents c
  WHERE c.driver_id=actor AND c.revoked_at IS NULL
   AND c.revision=proof.consent_revision
  FOR SHARE;
 consent_ok:=FOUND;
 IF NOT consent_ok THEN RAISE EXCEPTION 'G38 consent revision revoked'
  USING ERRCODE='G3801'; END IF;
 -- The newest accepted QA signal must match service, zone and revisions,
 -- but quarantine can NEVER become real dispatch authorization.
 PERFORM 1 FROM public.mobility_stage_g32_signal_state s
  JOIN public.mobility_stage_g32_signal_quarantine q
   ON q.driver_id=s.driver_id AND q.event_id=s.last_event_id
   AND q.sequence=s.last_sequence
  JOIN public.driver_locations l ON l.driver_id=s.driver_id
  WHERE s.driver_id=actor AND q.zone_id=proof.zone_id
   AND q.service_kind=service
   AND q.consent_revision=proof.consent_revision
   AND q.geometry_revision=proof.geometry_revision
   AND q.captured_at>=pg_catalog.clock_timestamp()-interval '30 seconds'
   AND q.captured_at<=pg_catalog.clock_timestamp()
   AND l.available AND l.updated_at>=pg_catalog.clock_timestamp()-interval '60 seconds'
   AND l.updated_at<=pg_catalog.clock_timestamp()
  FOR SHARE OF s,q,l;
 signal_ok:=FOUND;
 IF NOT signal_ok THEN RAISE EXCEPTION 'G38 no current fenced location/availability evidence'
  USING ERRCODE='G3801'; END IF;
 -- Hold mutable KYC rows during the assignment transaction; G20/G36
 -- already execute their selected-vehicle preflight on acceptance.
 PERFORM 1 FROM public.mobility_driver_compliance dc
  JOIN public.mobility_vehicles v ON v.driver_id=dc.driver_id
  WHERE dc.driver_id=actor AND v.id=vehicle
   AND dc.driver_review_status='approved'
   AND dc.license_valid_through>=CURRENT_DATE
  FOR SHARE OF dc,v;
 docs_ok:=FOUND;
 IF NOT docs_ok THEN RAISE EXCEPTION 'G38 KYC revoked'
  USING ERRCODE='G3801'; END IF;
 -- Check unresolved dispute as case hold; never steal a slot retroactively.
 IF EXISTS(SELECT 1 FROM public.mobility_stage_deliveries d
   WHERE d.courier_id=actor AND d.status='disputed')
 THEN RAISE EXCEPTION 'G38 Driver has an unresolved cargo dispute'
  USING ERRCODE='G3801'; END IF;
 -- G31 stores zone coverage, NOT permits, and requires false policy in QA.
 -- Future release needs legal/insurance/geometry/credential gates; a
 -- fabricated row cannot turn synthetic staging into commercial eligibility.
 PERFORM 1 FROM public.mobility_stage_g31_zone_coverage z
  WHERE z.zone_id=proof.zone_id AND z.service_kind=service
   AND z.coverage_status='ACTIVE'
   AND z.eligible_by_policy IS TRUE AND z.revision=proof.policy_revision
  FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'G38 no certified zone legal/geometry policy'
   USING ERRCODE='G3801'; END IF;
 -- A verified policy is necessary but not sufficient: real rollout also
 -- needs a full external certified proof issuer and deployment approval.
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g38_acceptance_fence()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mobility_stage_g38_auto_acceptance
 BEFORE UPDATE OF status ON public.mobility_stage_auto_demo_trips
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g38_acceptance_fence();
CREATE TRIGGER mobility_stage_g38_delivery_acceptance
 BEFORE UPDATE OF status ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g38_acceptance_fence();
COMMIT;
