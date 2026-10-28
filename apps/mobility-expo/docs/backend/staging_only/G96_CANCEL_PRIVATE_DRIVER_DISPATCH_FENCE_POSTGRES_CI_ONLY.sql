-- G96: Stop any private AUTO Driver offer, durable dispatch job and
-- late push ACK at the actual G3 passenger cancellation COMMIT boundary.
-- Disposable PG16 QA only. No real notification sending, provider receipt,
-- external GPS, legal proof issuance or live fare.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g95_cancel_booked_auto_qa(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_ack_auto_demo_push(uuid,uuid,text)') IS NULL
 OR to_regclass('public.mobility_stage_g85_auto_dispatch_jobs') IS NULL
 THEN RAISE EXCEPTION 'G96 requires disposable G95 G85 G4 SQL'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g96_cancel_dispatch_fence_qa()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 has_booking boolean;
 affected integer;
 active_after integer;
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public'
 OR TG_TABLE_NAME<>'mobility_stage_auto_demo_trips'
 THEN RAISE EXCEPTION 'G96 invalid trip mutation origin' USING ERRCODE='P9601'; END IF;
 IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status='cancelled' THEN RETURN NEW; END IF;
 SELECT EXISTS(SELECT 1
 FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_g73_auto_routes r
  ON r.id=q.route_id AND r.passenger_id=q.passenger_id
 WHERE q.trip_id=NEW.id AND q.booking_key=NEW.request_key
  AND q.passenger_id=NEW.passenger_id
  AND q.service=NEW.service
  AND r.service=NEW.service
  AND r.origin_tag=NEW.origin_tag AND r.destination_tag=NEW.destination_tag)
 INTO has_booking;
 IF NOT has_booking THEN RETURN NEW; END IF; -- Older G3 QA fixture, not G73.

 -- With G85 worker the booking has one durable job. Close its queue before
 -- returning the cancellation COMMIT. A G87 retry cannot revive CLOSED.
 UPDATE public.mobility_stage_g85_auto_dispatch_jobs
 SET status='CLOSED',offer_id=NULL,
  updated_at=pg_catalog.clock_timestamp()
 WHERE trip_id=NEW.id AND passenger_id=NEW.passenger_id
  AND booking_key=NEW.request_key;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'G96 missing original dispatch job'
  USING ERRCODE='P9601'; END IF;
 -- Do not change a Driver's already accepted decision: preserve its audit.
 -- Unaccepted outstanding offers become withdrawn and cannot be accepted.
 UPDATE public.mobility_stage_auto_demo_offers
 SET status='withdrawn'
 WHERE trip_id=NEW.id AND status='offered';
 SELECT count(*) INTO active_after FROM public.mobility_stage_auto_demo_offers
 WHERE trip_id=NEW.id AND status='offered';
 IF active_after<>0 THEN RAISE EXCEPTION 'G96 stale offer after cancellation'
 USING ERRCODE='P9601'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_stage_g96_cancel_private_dispatch
 AFTER UPDATE OF status ON public.mobility_stage_auto_demo_trips
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g96_cancel_dispatch_fence_qa();

-- At-most-once claims may have happened BEFORE cancellation. The provider
-- ACK must acquire a SHARE lock on the actual trip, then inspect its offer:
-- commits are serialized against G3 cancellation (which locks the trip).
-- Already-delivered notifications cannot be unsent, so the external sender
-- still needs an immediate pre-send authorization check when deployed.
CREATE FUNCTION public.mobility_stage_g96_no_late_push_ack_qa()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE t_status public.mobility_stage_trip_status;
 f_status public.mobility_stage_offer_state;
 f_expiry timestamptz;
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public'
 OR TG_TABLE_NAME<>'mobility_stage_auto_demo_push_outbox'
 THEN RAISE EXCEPTION 'G96 unexpected outbox mutation' USING ERRCODE='P9601'; END IF;
 IF NEW.accepted_for_processing_at IS NULL
 OR OLD.accepted_for_processing_at IS NOT NULL THEN RETURN NEW; END IF;
 SELECT t.status INTO t_status
 FROM public.mobility_stage_auto_demo_offers o
 JOIN public.mobility_stage_auto_demo_trips t ON t.id=o.trip_id
 WHERE o.id=NEW.offer_id AND o.driver_id=NEW.driver_id
 FOR SHARE OF t;
 IF NOT FOUND OR t_status<>'searching'
 THEN RAISE EXCEPTION 'G96 push ACK denied after trip change'
 USING ERRCODE='P9601'; END IF;
 SELECT status,expires_at INTO f_status,f_expiry
 FROM public.mobility_stage_auto_demo_offers
 WHERE id=NEW.offer_id AND driver_id=NEW.driver_id FOR SHARE;
 IF NOT FOUND OR f_status<>'offered' OR f_expiry<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G96 push ACK denied after offer withdrawal/expiry'
 USING ERRCODE='P9601'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_stage_g96_push_ack_current_trip
 BEFORE UPDATE OF accepted_for_processing_at
 ON public.mobility_stage_auto_demo_push_outbox
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g96_no_late_push_ack_qa();

-- Only a private server worker may recheck before calling its provider,
-- never grant this to the mobile app or user JWT.
CREATE FUNCTION public.mobility_stage_g96_push_still_eligible_qa(
 _offer_id uuid,_driver_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE t_status public.mobility_stage_trip_status;
 f_status public.mobility_stage_offer_state;
 v_expiry timestamptz;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _offer_id IS NULL OR _driver_id IS NULL THEN RETURN false; END IF;
 SELECT t.status INTO t_status
 FROM public.mobility_stage_auto_demo_offers o
 JOIN public.mobility_stage_auto_demo_trips t ON t.id=o.trip_id
 JOIN public.mobility_stage_auto_demo_push_outbox b
  ON b.offer_id=o.id AND b.driver_id=o.driver_id
 WHERE o.id=_offer_id AND o.driver_id=_driver_id FOR SHARE OF t;
 IF NOT FOUND OR t_status<>'searching' THEN RETURN false; END IF;
 SELECT o.status,o.expires_at INTO f_status,v_expiry
 FROM public.mobility_stage_auto_demo_offers o
 WHERE o.id=_offer_id AND o.driver_id=_driver_id FOR SHARE;
 RETURN FOUND AND f_status='offered' AND v_expiry>pg_catalog.clock_timestamp();
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g96_cancel_dispatch_fence_qa()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g96_no_late_push_ack_qa()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g96_push_still_eligible_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g96_push_still_eligible_qa(uuid,uuid)
 TO service_role;
COMMIT;
