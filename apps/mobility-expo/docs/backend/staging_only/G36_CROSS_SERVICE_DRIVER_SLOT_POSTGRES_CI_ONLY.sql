-- G36 / A05.9 — Cross-service one-active-assignment per Driver.
-- PG16 qore_disposable_chain ONLY. NO remote staging or LIVE.
-- A durable unique slot protects AUTO rides and deliveries atomically,
-- including service_role direct SQL; advisory locks alone are insufficient.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
    current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G36 refuses non-disposable PostgreSQL'; END IF;
 IF to_regclass('public.mobility_stage_auto_demo_trips') IS NULL OR
 to_regclass('public.mobility_stage_deliveries') IS NULL OR
 to_regprocedure('public.mobility_stage_driver_current_license_approved(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G36 requires G3/G5/G20 verified schema'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g36_driver_slots (
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 assignment_kind text NOT NULL CHECK(assignment_kind IN ('AUTO_RIDE','DELIVERY')),
 assignment_id uuid NOT NULL,
 UNIQUE(assignment_kind,assignment_id),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
ALTER TABLE public.mobility_stage_g36_driver_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g36_driver_slots
 FROM PUBLIC,anon,authenticated,service_role;
-- Superuser/owner can migrate, but clients and service_role cannot forge,
-- delete, or read a slot directly. Only the trigger definer can mutate.

-- Adopt already active, synthetic G20 jobs, and fail if any Driver is
-- currently assigned in BOTH services. No silent conflict resolution.
INSERT INTO public.mobility_stage_g36_driver_slots
 (driver_id,assignment_kind,assignment_id)
SELECT driver_id,'AUTO_RIDE',id
FROM public.mobility_stage_auto_demo_trips
WHERE driver_id IS NOT NULL
 AND status IN ('accepted','arriving','in_progress')
UNION ALL
SELECT courier_id,'DELIVERY',id
FROM public.mobility_stage_deliveries
WHERE courier_id IS NOT NULL
 AND status IN ('accepted','picked_up','disputed');

CREATE FUNCTION public.mobility_stage_g36_claim_driver_slot()
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
  is_active:=NEW.status IN ('accepted','picked_up','disputed');
  IF TG_OP='UPDATE' THEN
   old_actor:=OLD.courier_id;
   was_active:=OLD.status IN ('accepted','picked_up','disputed');
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

REVOKE ALL ON FUNCTION public.mobility_stage_g36_claim_driver_slot()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mobility_stage_g36_auto_slot
 BEFORE INSERT OR UPDATE OF status,driver_id,vehicle_id,id
 ON public.mobility_stage_auto_demo_trips
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g36_claim_driver_slot();
CREATE TRIGGER mobility_stage_g36_delivery_slot
 BEFORE INSERT OR UPDATE OF status,courier_id,vehicle_id,id
 ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g36_claim_driver_slot();
COMMIT;
