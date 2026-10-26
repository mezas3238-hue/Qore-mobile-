-- G103 F1: one active Passenger ride across distinct AUTO and MOTO_RIDE
-- tables, including concurrent bookings. Strict disposable PG16 QA only.
-- A passenger with an active MOTO cannot book AUTO, and vice versa.
-- Existing Driver G38/KYC and all original G73/G100 gates remain intact.
DO $g$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR to_regclass('public.mobility_stage_g100_moto_trips') IS NULL
 OR to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g100_moto_book_qa(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G103 requires disposable F1 AUTO and MOTO QA'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.mobility_stage_auto_demo_trips a
  JOIN public.mobility_stage_g100_moto_trips m
   ON m.passenger_id=a.passenger_id AND m.status='searching'
  WHERE a.status IN ('searching','accepted','arriving','in_progress')
 ) THEN RAISE EXCEPTION 'G103 refused existing cross-service conflict'; END IF;
END $g$;
BEGIN;
-- Row lock on shared auth.users identity serializes inserts across these
-- two independently stored tables at READ COMMITTED. Unique per-table indexes
-- still reject two active rides of the same service.
CREATE FUNCTION public.mobility_stage_g103_one_active_ride_qa()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE booking_exists boolean;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G103 refused non-disposable booking' USING ERRCODE='P1031'; END IF;
 IF TG_OP NOT IN ('INSERT','UPDATE') OR NEW.passenger_id IS NULL
 THEN RAISE EXCEPTION 'G103 invalid booking identity' USING ERRCODE='P1031'; END IF;
 IF TG_TABLE_NAME='mobility_stage_auto_demo_trips' THEN
  IF NEW.status NOT IN ('searching','accepted','arriving','in_progress')
  THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='mobility_stage_g100_moto_trips' THEN
  IF NEW.status<>'searching' THEN RETURN NEW; END IF;
 ELSE
  RAISE EXCEPTION 'G103 invalid booking table' USING ERRCODE='P1031';
 END IF;
 -- A historical G3 replay should remain idempotent even if its original
 -- AUTO ride was later canceled/completed and MOTO is now active. No INSERT
 -- will occur because G3 uses ON CONFLICT(request_key) DO NOTHING.
 IF TG_OP='INSERT' AND TG_TABLE_NAME='mobility_stage_auto_demo_trips'
  AND EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips a
   WHERE a.request_key=NEW.request_key AND a.passenger_id=NEW.passenger_id
   AND a.service=NEW.service
   AND a.origin_tag=NEW.origin_tag AND a.destination_tag=NEW.destination_tag)
 THEN RETURN NEW; END IF;
 -- Acquire the same strong row lock for AUTO and MOTO. This is intentionally
 -- *before* the cross-table check: two concurrent inserts cannot both pass.
 PERFORM 1 FROM auth.users u WHERE u.id=NEW.passenger_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G103 passenger no longer exists'
  USING ERRCODE='P1031'; END IF;
 IF TG_TABLE_NAME='mobility_stage_auto_demo_trips' THEN
  SELECT EXISTS(SELECT 1 FROM public.mobility_stage_g100_moto_trips m
   WHERE m.passenger_id=NEW.passenger_id AND m.status='searching')
  INTO booking_exists;
 ELSE
  SELECT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips a
   WHERE a.passenger_id=NEW.passenger_id
    AND a.status IN ('searching','accepted','arriving','in_progress'))
  INTO booking_exists;
 END IF;
 IF booking_exists THEN
  RAISE EXCEPTION 'G103 one active passenger ride: cross-service request denied'
   USING ERRCODE='P1031'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_stage_g103_fence_auto
 BEFORE INSERT OR UPDATE OF status,passenger_id
 ON public.mobility_stage_auto_demo_trips FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g103_one_active_ride_qa();
CREATE TRIGGER mobility_stage_g103_fence_moto
 BEFORE INSERT OR UPDATE OF status,passenger_id
 ON public.mobility_stage_g100_moto_trips FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g103_one_active_ride_qa();
REVOKE ALL ON FUNCTION public.mobility_stage_g103_one_active_ride_qa()
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
