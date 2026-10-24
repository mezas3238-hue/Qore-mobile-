-- G38.0 — disputes are post-delivery cases, not physical in-flight jobs.
-- Retain G35 / G20 conservative unresolved-dispute eligibility exclusions.
-- PostgreSQL 16 qore_disposable_chain only; NEVER remotely apply.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g36_driver_slots') IS NULL
 OR to_regprocedure('public.mobility_stage_g37_state_integrity()') IS NULL
 THEN RAISE EXCEPTION 'G38.0 refuses non-disposable or incomplete G37 chain'; END IF;
END $guard$;
BEGIN;
-- A late dispute must never fail simply because a courier has accepted a
-- different delivery since the earlier order was completed. Keep the
-- requested/accepted/picked_up unique courier invariant.
DROP INDEX public.mobility_stage_one_active_delivery_courier;
CREATE UNIQUE INDEX mobility_stage_one_active_delivery_courier
 ON public.mobility_stage_deliveries(courier_id)
 WHERE courier_id IS NOT NULL AND status IN ('accepted','picked_up');
-- G36's slot is held only for actual in-flight custody; disputed documents
-- are case-managed, not secretly reassigned.
CREATE OR REPLACE FUNCTION public.mobility_stage_g36_claim_driver_slot()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 actor uuid;
 old_actor uuid;
 is_active boolean;
 was_active boolean:=false;
 kind text;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN
 ('mobility_stage_auto_demo_trips','mobility_stage_deliveries')
 THEN RAISE EXCEPTION 'G36 trigger origin invalid' USING ERRCODE='G3601'; END IF;
 IF TG_TABLE_NAME='mobility_stage_auto_demo_trips' THEN
  kind:='AUTO_RIDE';actor:=NEW.driver_id;
  is_active:=NEW.status IN ('accepted','arriving','in_progress');
  IF TG_OP='UPDATE' THEN
   old_actor:=OLD.driver_id;
   was_active:=OLD.status IN ('accepted','arriving','in_progress');
  END IF;
 ELSE
  kind:='DELIVERY';actor:=NEW.courier_id;
  is_active:=NEW.status IN ('accepted','picked_up');
  IF TG_OP='UPDATE' THEN
   old_actor:=OLD.courier_id;
   was_active:=OLD.status IN ('accepted','picked_up');
  END IF;
 END IF;

 IF was_active AND (actor IS DISTINCT FROM old_actor OR NEW.id<>OLD.id)
 THEN RAISE EXCEPTION 'G36 cannot transfer an active assignment or its identity'
  USING ERRCODE='G3601'; END IF;
 IF is_active AND actor IS NULL
 THEN RAISE EXCEPTION 'G36 active assignment requires a Driver'
  USING ERRCODE='G3601'; END IF;
 IF was_active AND NOT is_active THEN
  DELETE FROM public.mobility_stage_g36_driver_slots s
  WHERE s.driver_id=old_actor AND s.assignment_kind=kind AND s.assignment_id=OLD.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'G36 active slot missing on release'
    USING ERRCODE='G3601'; END IF;
 ELSIF is_active AND NOT was_active THEN
  -- Re-read selected vehicle and eligibility at the acceptance boundary.
  -- For DELIVERY the OLD row must still be requested so the G20 preflight
  -- can validate cargo dimensions/insurance against THIS job ID.
  IF TG_TABLE_NAME='mobility_stage_auto_demo_trips' THEN
   IF NEW.vehicle_id IS NULL OR
    NOT public.mobility_vehicle_preflight(actor,NEW.vehicle_id,NEW.service)
   THEN RAISE EXCEPTION 'G36 selected AUTO vehicle not eligible'
    USING ERRCODE='G3601'; END IF;
  ELSE
   IF NEW.vehicle_id IS NULL OR
     TG_OP<>'UPDATE' OR OLD.status<>'requested' OR
     NOT public.mobility_stage_delivery_courier_preflight(
       actor,NEW.vehicle_id,NEW.id)
   THEN RAISE EXCEPTION 'G36 selected delivery vehicle not eligible'
    USING ERRCODE='G3601'; END IF;
  END IF;
  BEGIN
   INSERT INTO public.mobility_stage_g36_driver_slots(
    driver_id,assignment_kind,assignment_id) VALUES(actor,kind,NEW.id);
  EXCEPTION WHEN unique_violation THEN
   RAISE EXCEPTION 'G36 Driver already occupies another job'
    USING ERRCODE='G3601';
  END;
 ELSIF is_active AND was_active THEN
  -- A vehicle swap in flight would bypass the original preflight; block it.
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
  THEN RAISE EXCEPTION 'G36 cannot change selected vehicle while active'
    USING ERRCODE='G3601'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots s
   WHERE s.driver_id=actor AND s.assignment_kind=kind AND s.assignment_id=NEW.id)
  THEN RAISE EXCEPTION 'G36 active assignment lost its slot'
   USING ERRCODE='G3601'; END IF;
 END IF;
 RETURN NEW;
END $body$;


-- Refuse inconsistent legacy active slots: a dispute should have no slot.
DO $adoption$
BEGIN
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots s
 JOIN public.mobility_stage_deliveries d
 ON d.id=s.assignment_id AND s.assignment_kind='DELIVERY'
 WHERE d.status='disputed')
 THEN RAISE EXCEPTION 'G38.0 cannot migrate stale dispute-assignment slot'; END IF;
END $adoption$;
COMMIT;
