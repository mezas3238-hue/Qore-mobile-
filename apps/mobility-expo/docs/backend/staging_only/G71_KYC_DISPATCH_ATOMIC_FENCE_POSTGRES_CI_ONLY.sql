-- G71: PostgreSQL 16 disposable QA ONLY. No remote migrations or commercial use.
-- After G17/G20/G37/G38 and eight-document onboarding/expiry fixtures.
DO $g$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_kyc_expiry_snapshot_owner_qa(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g38_acceptance_fence()') IS NULL
 THEN RAISE EXCEPTION 'G71 isolated PostgreSQL KYC prerequisites missing'; END IF;
END $g$;
BEGIN;

-- Serialize new document versions and new role grants with dispatch reads.
-- A new upload must not slip between the "latest source" check and COMMIT.
CREATE FUNCTION public.mobility_stage_g71_document_insert_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM 1 FROM auth.users WHERE id=NEW.driver_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown document owner' USING ERRCODE='P7401'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER a00_g71_document_insert
 BEFORE INSERT ON public.mobility_stage_driver_documents
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g71_document_insert_lock();

CREATE FUNCTION public.mobility_stage_g71_role_insert_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM 1 FROM auth.users WHERE id=NEW.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown role owner' USING ERRCODE='P7401'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER a00_g71_role_insert BEFORE INSERT ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g71_role_insert_lock();

CREATE FUNCTION public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 d ALIAS FOR $1; v_id ALIAS FOR $2;
 actor uuid; role_id uuid; vehicle public.mobility_vehicles%ROWTYPE;
 decision uuid; e public.mobility_stage_kyc_verified_evidence_qa%ROWTYPE;
 source public.mobility_stage_driver_documents%ROWTYPE;
 seen text[]:=ARRAY[]::text[];
 expected text[]:=ARRAY['licencia','identidad_frente','identidad_dorso',
   'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie'];
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR d IS NULL OR v_id IS NULL THEN RETURN false; END IF;
 SELECT id INTO actor FROM auth.users WHERE id=d FOR SHARE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT user_id INTO role_id FROM public.user_roles
 WHERE user_id=d AND role='driver'::public.app_role FOR SHARE;
 IF NOT FOUND OR (SELECT count(*) FROM public.user_roles WHERE user_id=d)<>1
 THEN RETURN false; END IF;
 SELECT * INTO vehicle FROM public.mobility_vehicles
 WHERE id=v_id AND driver_id=d FOR SHARE;
 IF NOT FOUND OR vehicle.country_code<>'PY'
 OR vehicle.review_status IN ('rejected'::public.mobility_review_status,
                              'suspended'::public.mobility_review_status)
 THEN RETURN false; END IF;
 SELECT a.id INTO decision FROM public.mobility_stage_kyc_onboarding_decisions_qa a
 WHERE a.driver_id=d AND a.vehicle_id=v_id
 AND a.decision='QA_ONBOARDING_APPROVED_NOT_COMMERCIAL' FOR SHARE;
 IF NOT FOUND THEN RETURN false; END IF;
 FOR e IN SELECT * FROM public.mobility_stage_kyc_verified_evidence_qa
          WHERE driver_id=d AND vehicle_id=v_id ORDER BY kind FOR SHARE LOOP
  SELECT * INTO source FROM public.mobility_stage_driver_documents
   WHERE id=e.source_document_id FOR SHARE;
  IF NOT FOUND OR source.driver_id<>d OR source.kind::text<>e.kind
    OR source.status='rejected'::public.mobility_stage_driver_document_status
    OR EXISTS(SELECT 1 FROM public.mobility_stage_driver_documents newer
       WHERE newer.driver_id=d AND newer.kind=source.kind
       AND (newer.submitted_at,newer.id)>(source.submitted_at,source.id))
    OR e.verified_by<>'QA_INDEPENDENT_ATTESTOR_NO_MEDIA'
    OR e.authenticity_verified IS DISTINCT FROM true
    OR e.issuer_verified IS DISTINCT FROM true
    OR e.malware_scan_passed IS DISTINCT FROM true
    OR e.evidence_revision<1
    OR e.valid_until<=pg_catalog.clock_timestamp()
    OR (e.kind='rostro_selfie' AND
       (e.photo_received IS DISTINCT FROM true
       OR e.consent_for_face IS DISTINCT FROM true
       OR e.liveness_verified IS DISTINCT FROM true
       OR e.id_face_match_verified IS DISTINCT FROM true))
  THEN RETURN false; END IF;
  seen:=pg_catalog.array_append(seen,e.kind);
 END LOOP;
 RETURN pg_catalog.cardinality(seen)=8 AND expected <@ seen;
END $f$;

-- These four triggers cover INSERT of both offer types and UPDATE into
-- accepted assignment even if a new caller bypasses the normal RPC.
CREATE FUNCTION public.mobility_stage_g71_assignment_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE d uuid; v uuid; check_now boolean:=false;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' THEN
  RAISE EXCEPTION 'Invalid KYC dispatch schema' USING ERRCODE='P7401'; END IF;
 IF TG_TABLE_NAME='mobility_stage_auto_demo_offers' AND TG_OP='INSERT' THEN
  d:=NEW.driver_id; v:=NEW.vehicle_id; check_now:=true;
 ELSIF TG_TABLE_NAME='mobility_stage_delivery_offers' AND TG_OP='INSERT' THEN
  d:=NEW.courier_id; v:=NEW.vehicle_id; check_now:=true;
 ELSIF TG_TABLE_NAME='mobility_stage_auto_demo_trips' AND TG_OP='UPDATE' THEN
  d:=NEW.driver_id; v:=NEW.vehicle_id;
  check_now:=NEW.status::text='accepted' AND
    (OLD.status::text<>'accepted' OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id);
 ELSIF TG_TABLE_NAME='mobility_stage_deliveries' AND TG_OP='UPDATE' THEN
  d:=NEW.courier_id; v:=NEW.vehicle_id;
  check_now:=NEW.status::text='accepted' AND
    (OLD.status::text<>'accepted' OR NEW.courier_id IS DISTINCT FROM OLD.courier_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id);
 ELSE RAISE EXCEPTION 'Unexpected KYC mutation' USING ERRCODE='P7401'; END IF;
 IF check_now AND NOT public.mobility_stage_g71_valid_locked_dossier(d,v)
 THEN RAISE EXCEPTION 'Driver KYC expired, unverified, replaced or suspended'
 USING ERRCODE='P7401'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER a00_g71_auto_offer
 BEFORE INSERT ON public.mobility_stage_auto_demo_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g71_assignment_trigger();
CREATE TRIGGER a00_g71_delivery_offer
 BEFORE INSERT ON public.mobility_stage_delivery_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g71_assignment_trigger();
CREATE TRIGGER a00_g71_auto_assign
 BEFORE UPDATE OF status,driver_id,vehicle_id ON public.mobility_stage_auto_demo_trips
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g71_assignment_trigger();
CREATE TRIGGER a00_g71_delivery_assign
 BEFORE UPDATE OF status,courier_id,vehicle_id ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g71_assignment_trigger();

-- Fences idempotent replay: an old offer/accept receipt cannot be returned to
-- a newly expired driver. Original procedures become owner-only core APIs.
ALTER FUNCTION public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)
 RENAME TO mobility_stage_g71_auto_offer_core;
ALTER FUNCTION public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)
 RENAME TO mobility_stage_g71_auto_accept_core;
ALTER FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)
 RENAME TO mobility_stage_g71_delivery_offer_core;
ALTER FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)
 RENAME TO mobility_stage_g71_delivery_accept_core;

CREATE FUNCTION public.mobility_stage_auto_demo_offer(
 _trip_id uuid,_driver_id uuid,_vehicle_id uuid,_request_key uuid,_ttl_seconds integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF NOT public.mobility_stage_g71_valid_locked_dossier($2,$3)
 THEN RAISE EXCEPTION 'KYC offer denied' USING ERRCODE='P7401'; END IF;
 RETURN public.mobility_stage_g71_auto_offer_core($1,$2,$3,$4,$5);
END $f$;
CREATE FUNCTION public.mobility_stage_delivery_offer(
 _delivery_id uuid,_courier_id uuid,_vehicle_id uuid,_request_key uuid,_ttl_seconds integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF NOT public.mobility_stage_g71_valid_locked_dossier($2,$3)
 THEN RAISE EXCEPTION 'KYC delivery offer denied' USING ERRCODE='P7401'; END IF;
 RETURN public.mobility_stage_g71_delivery_offer_core($1,$2,$3,$4,$5);
END $f$;
CREATE FUNCTION public.mobility_stage_auto_demo_accept_offer(
 _offer_id uuid,_driver_id uuid,_decision_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE v uuid;
BEGIN
 SELECT vehicle_id INTO v FROM public.mobility_stage_auto_demo_offers
 WHERE id=$1 AND driver_id=$2;
 IF NOT FOUND OR NOT public.mobility_stage_g71_valid_locked_dossier($2,v)
 THEN RAISE EXCEPTION 'KYC trip acceptance denied' USING ERRCODE='P7401'; END IF;
 RETURN public.mobility_stage_g71_auto_accept_core($1,$2,$3);
END $f$;
CREATE FUNCTION public.mobility_stage_delivery_accept_offer(
 _offer_id uuid,_courier_id uuid,_decision_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE v uuid;
BEGIN
 SELECT vehicle_id INTO v FROM public.mobility_stage_delivery_offers
 WHERE id=$1 AND courier_id=$2;
 IF NOT FOUND OR NOT public.mobility_stage_g71_valid_locked_dossier($2,v)
 THEN RAISE EXCEPTION 'KYC courier acceptance denied' USING ERRCODE='P7401'; END IF;
 RETURN public.mobility_stage_g71_delivery_accept_core($1,$2,$3);
END $f$;

-- No handset, admin, or service-role ability to call raw cores or helpers.
REVOKE ALL ON FUNCTION public.mobility_stage_g71_document_insert_lock()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g71_role_insert_lock()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g71_assignment_trigger()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g71_auto_offer_core(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g71_auto_accept_core(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g71_delivery_offer_core(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g71_delivery_accept_core(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)
 TO service_role;
COMMIT;
