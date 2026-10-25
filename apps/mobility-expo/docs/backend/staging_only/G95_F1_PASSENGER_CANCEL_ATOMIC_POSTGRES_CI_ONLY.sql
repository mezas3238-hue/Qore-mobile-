-- G95: official Passenger cancellation keyed to original G73 booking;
-- G3 authorizes transitions, G94 reverses provisional G93 ledger atomically.
-- DISPOSABLE PostgreSQL16 QA ONLY. NO live payments, mobile release or PSP.
DO $g$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g73_booking_receipt(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g94_auto_financial_state_qa(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_auto_demo_transition(uuid,uuid,public.mobility_stage_trip_status,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G95 requires fenced disposable G73/G94/G3'; END IF;
END $g$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g95_cancel_receipt_qa(
 _passenger_id uuid,_booking_key uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 r record;
 entry_count bigint;
 matched_count bigint;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _booking_key IS NULL
 THEN RAISE EXCEPTION 'G95 private read scope invalid' USING ERRCODE='P9501'; END IF;
 SELECT t.id AS trip_id,t.status AS trip_state,t.revision,
  q.id AS quote_id,e.id AS event_id,e.request_key AS decision_key,
  l.quote_id AS ledger_quote_id,v.quote_id AS void_quote_id
 INTO r FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_g73_auto_routes route
  ON route.id=q.route_id AND route.passenger_id=q.passenger_id
 JOIN public.mobility_stage_auto_demo_trips t
  ON t.id=q.trip_id AND t.passenger_id=q.passenger_id
  AND t.request_key=q.booking_key AND t.service=route.service
  AND t.origin_tag=route.origin_tag AND t.destination_tag=route.destination_tag
 JOIN public.mobility_stage_auto_demo_events e
  ON e.trip_id=t.id AND e.next_status='cancelled'
  AND e.actor_id=t.passenger_id AND e.trip_revision=t.revision
 LEFT JOIN public.mobility_stage_g93_auto_ledger l
  ON l.quote_id=q.id AND l.trip_id=t.id AND l.booking_key=q.booking_key
 LEFT JOIN public.mobility_stage_g94_auto_voids v
  ON v.quote_id=l.quote_id AND v.trip_id=t.id
  AND v.booking_key=q.booking_key AND v.voided_revision=t.revision
 WHERE q.passenger_id=_passenger_id AND q.booking_key=_booking_key
  AND t.status='cancelled';
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF r.ledger_quote_id IS NOT NULL THEN
  SELECT count(*),count(*) FILTER(WHERE
    x.account=y.account AND x.amount_gs=y.amount_gs
    AND x.side<>y.side)
   INTO entry_count,matched_count
  FROM public.mobility_stage_g93_auto_ledger_entries x
  LEFT JOIN public.mobility_stage_g94_auto_void_entries y
   ON y.quote_id=x.quote_id AND y.account=x.account
  WHERE x.quote_id=r.ledger_quote_id;
  IF r.void_quote_id IS NULL OR entry_count<>4 OR matched_count<>4
  THEN RAISE EXCEPTION 'G95 financial cancellation not reconciled'
   USING ERRCODE='P9501'; END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',_passenger_id,'bookingKey',_booking_key,
  'cancellationKey',r.decision_key,'eventId',r.event_id,
  'tripId',r.trip_id,'quoteId',r.quote_id,
  'tripState','cancelled','tripRevision',r.revision,
  'financialState',CASE WHEN r.ledger_quote_id IS NOT NULL
   THEN 'VOIDED_QA' ELSE 'NO_CAMPAIGN_QA' END,
  'reversalEntriesBalanced',(r.ledger_quote_id IS NOT NULL),
  'pspCollected',false,'pspRefunded',false,'serverPersisted',true);
END $f$;

CREATE FUNCTION public.mobility_stage_g95_cancel_booked_auto_qa(
 _passenger_id uuid,_booking_key uuid,_cancellation_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 trip public.mobility_stage_auto_demo_trips%ROWTYPE;
 prior public.mobility_stage_auto_demo_events%ROWTYPE;
 event_id uuid;
 receipt jsonb;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _booking_key IS NULL OR _cancellation_key IS NULL
 OR (SELECT count(*) FROM public.user_roles
      WHERE user_id=_passenger_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
      WHERE user_id=_passenger_id AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G95 private Passenger authority denied'
   USING ERRCODE='P9501'; END IF;
 SELECT t.* INTO trip
 FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_g73_auto_routes route
  ON route.id=q.route_id AND route.passenger_id=q.passenger_id
 JOIN public.mobility_stage_auto_demo_trips t
  ON t.id=q.trip_id AND t.passenger_id=q.passenger_id
  AND t.request_key=q.booking_key AND t.service=route.service
  AND t.origin_tag=route.origin_tag AND t.destination_tag=route.destination_tag
 WHERE q.passenger_id=_passenger_id AND q.booking_key=_booking_key
 FOR UPDATE OF t;
 IF NOT FOUND OR trip.passenger_id<>_passenger_id
 THEN RAISE EXCEPTION 'G95 inaccessible booked AUTO' USING ERRCODE='P9501'; END IF;

 SELECT * INTO prior FROM public.mobility_stage_auto_demo_events
 WHERE request_key=_cancellation_key;
 IF FOUND THEN
  IF prior.trip_id IS DISTINCT FROM trip.id
   OR prior.actor_id IS DISTINCT FROM _passenger_id
   OR prior.next_status IS DISTINCT FROM 'cancelled'
   OR trip.status IS DISTINCT FROM 'cancelled'
  THEN RAISE EXCEPTION 'G95 cross-booking cancellation key replay'
   USING ERRCODE='P9501'; END IF;
 ELSE
  IF trip.status NOT IN ('searching','accepted','arriving')
  THEN RAISE EXCEPTION 'G95 trip cannot be cancelled in current phase'
   USING ERRCODE='P9501'; END IF;
  -- The existing G3 function performs actor authorization and exactly
  -- one state event; G94 financial reversal fires in this same transaction.
  event_id:=public.mobility_stage_auto_demo_transition(
   trip.id,_passenger_id,'cancelled'::public.mobility_stage_trip_status,
   _cancellation_key);
 END IF;
 receipt:=public.mobility_stage_g95_cancel_receipt_qa(_passenger_id,_booking_key);
 IF receipt IS NULL
 OR receipt->>'tripId' IS DISTINCT FROM trip.id::text
 OR receipt->>'cancellationKey' IS DISTINCT FROM _cancellation_key::text
 OR (event_id IS NOT NULL AND receipt->>'eventId' IS DISTINCT FROM event_id::text)
 OR receipt->>'pspCollected'<>'false'
 OR receipt->>'pspRefunded'<>'false'
 THEN RAISE EXCEPTION 'G95 cancel and reversal not atomically reconciled'
  USING ERRCODE='P9501'; END IF;
 RETURN receipt;
END $f$;

REVOKE ALL ON FUNCTION public.mobility_stage_g95_cancel_receipt_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g95_cancel_booked_auto_qa(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g95_cancel_receipt_qa(uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g95_cancel_booked_auto_qa(uuid,uuid,uuid)
 TO service_role;
COMMIT;
