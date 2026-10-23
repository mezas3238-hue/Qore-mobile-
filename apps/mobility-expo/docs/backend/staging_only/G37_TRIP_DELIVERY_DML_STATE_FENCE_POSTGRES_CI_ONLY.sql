-- G37 / A18 — fail-closed mutations and state transitions (PG16 disposable only).
-- NEVER apply to remotely hosted, shared, staging or production databases.
-- G4/G10 private-offer acceptance remains the ONLY service_role accept path.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
  OR current_setting('application_name')<>'qore_ci_disposable_chain'
  OR to_regclass('public.mobility_stage_g36_driver_slots') IS NULL
 THEN RAISE EXCEPTION 'G37 refuses non-disposable or incomplete G36 database'; END IF;
END $guard$;
BEGIN;

CREATE FUNCTION public.mobility_stage_g37_state_integrity()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $guardbody$
BEGIN
 IF TG_TABLE_SCHEMA<>'public'
  OR TG_TABLE_NAME NOT IN ('mobility_stage_auto_demo_trips','mobility_stage_deliveries')
 THEN RAISE EXCEPTION 'G37 unexpected table' USING ERRCODE='G3701'; END IF;
 IF TG_TABLE_NAME='mobility_stage_auto_demo_trips' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.status<>'searching' OR NEW.driver_id IS NOT NULL
    OR NEW.vehicle_id IS NOT NULL OR NEW.revision<>1
   THEN RAISE EXCEPTION 'G37 AUTO initial state forged' USING ERRCODE='G3701'; END IF;
  ELSE
   IF ROW(NEW.id,NEW.request_key,NEW.passenger_id,NEW.service,
          NEW.origin_tag,NEW.destination_tag,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.request_key,OLD.passenger_id,OLD.service,
                         OLD.origin_tag,OLD.destination_tag,OLD.created_at)
    OR (OLD.driver_id IS NOT NULL AND
        (NEW.driver_id IS DISTINCT FROM OLD.driver_id
          OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id))
    OR NEW.revision<>OLD.revision+1
    OR NOT (
       (OLD.status='searching' AND NEW.status IN ('accepted','cancelled'))
       OR (OLD.status='accepted' AND NEW.status IN ('arriving','cancelled'))
       OR (OLD.status='arriving' AND NEW.status IN ('in_progress','cancelled'))
       OR (OLD.status='in_progress' AND NEW.status='completed')
    )
   THEN RAISE EXCEPTION 'G37 AUTO immutable identity or invalid transition'
    USING ERRCODE='G3701'; END IF;
  END IF;
 ELSE
  IF TG_OP='INSERT' THEN
   IF NEW.status<>'requested' OR NEW.courier_id IS NOT NULL
    OR NEW.vehicle_id IS NOT NULL OR NEW.proof_ref IS NOT NULL
    OR NEW.revision<>1
   THEN RAISE EXCEPTION 'G37 cargo initial state forged' USING ERRCODE='G3701'; END IF;
  ELSE
   IF ROW(NEW.id,NEW.request_key,NEW.sender_id,NEW.requested_vehicle_kind,
          NEW.category,NEW.grams,NEW.length_cm,NEW.width_cm,NEW.height_cm,
          NEW.pickup_tag,NEW.delivery_tag,NEW.restricted_item_declared,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.request_key,OLD.sender_id,OLD.requested_vehicle_kind,
                         OLD.category,OLD.grams,OLD.length_cm,OLD.width_cm,OLD.height_cm,
                         OLD.pickup_tag,OLD.delivery_tag,OLD.restricted_item_declared,OLD.created_at)
    OR (OLD.courier_id IS NOT NULL AND
        (NEW.courier_id IS DISTINCT FROM OLD.courier_id
         OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id))
    OR (NEW.proof_ref IS DISTINCT FROM OLD.proof_ref AND NOT (
        OLD.status='picked_up' AND NEW.status='delivered'
        AND OLD.proof_ref IS NULL AND NEW.proof_ref IS NOT NULL))
    OR NEW.revision<>OLD.revision+1
    OR NOT (
       (OLD.status='requested' AND NEW.status IN ('accepted','cancelled'))
       OR (OLD.status='accepted' AND NEW.status IN ('picked_up','cancelled'))
       OR (OLD.status='picked_up' AND NEW.status='delivered')
       OR (OLD.status='delivered' AND NEW.status='disputed')
       OR (OLD.status='disputed' AND NEW.status='returned')
    )
   THEN RAISE EXCEPTION 'G37 cargo immutable identity or invalid transition'
    USING ERRCODE='G3701'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $guardbody$;

REVOKE ALL ON FUNCTION public.mobility_stage_g37_state_integrity()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mobility_stage_g37_auto_integrity
 BEFORE INSERT OR UPDATE ON public.mobility_stage_auto_demo_trips
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g37_state_integrity();
CREATE TRIGGER mobility_stage_g37_delivery_integrity
 BEFORE INSERT OR UPDATE ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g37_state_integrity();

-- Keep existing explicit EXECUTE grants ONLY for the privileged server role.
-- SECURITY DEFINER is necessary after table DML is revoked: no browser role
-- gains execute permission. Existing RPC actor/session validation is NOT an
-- independent real Auth provider and must remain disabled on the public internet.
ALTER FUNCTION public.mobility_stage_auto_demo_request(
 uuid,uuid,text,text,public.mobility_service_kind) SECURITY DEFINER;
ALTER FUNCTION public.mobility_stage_auto_demo_transition(
 uuid,uuid,public.mobility_stage_trip_status,uuid) SECURITY DEFINER;
ALTER FUNCTION public.mobility_stage_auto_demo_accept_offer(
 uuid,uuid,uuid) SECURITY DEFINER;
ALTER FUNCTION public.mobility_stage_delivery_request(
 uuid,uuid,public.mobility_vehicle_kind,public.mobility_stage_delivery_category,
 integer,integer,integer,integer,text,text,boolean) SECURITY DEFINER;
ALTER FUNCTION public.mobility_stage_delivery_transition(
 uuid,uuid,text,uuid,uuid) SECURITY DEFINER;
ALTER FUNCTION public.mobility_stage_delivery_accept_offer(
 uuid,uuid,uuid) SECURITY DEFINER;

-- Direct pre-offer accepts remain revoked and SECURITY INVOKER.
REVOKE EXECUTE ON FUNCTION public.mobility_stage_auto_demo_accept(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_accept(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

-- Only controlled RPCs may write assignment rows or event receipts.
REVOKE INSERT,UPDATE,DELETE ON public.mobility_stage_auto_demo_trips
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.mobility_stage_deliveries
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.mobility_stage_auto_demo_events
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.mobility_stage_delivery_events
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
