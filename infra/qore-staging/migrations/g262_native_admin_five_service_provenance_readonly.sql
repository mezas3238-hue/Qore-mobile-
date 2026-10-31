-- G262: persistent PG17 STAGING native-source Admin provenance bridge.
-- All five originals: AUTO/MOTO passenger, AUTO/MOTO parcel, commerce.
-- READ ONLY; cannot create rides, assign Driver, settle, or authorize payments.
-- This supplements the original G138/142/145/146 disposable QA receipts.
-- It NEVER claims those disposable-priced/AAL2 gateways are installed.
-- Caller must ALSO validate actual provider JWT+G42 session+G260 AAL2;
-- this SQL enforces independently registered exclusive Admin role (G27).
-- SECURITY INVOKER, service_role backend only; never grant anon/authenticated.

CREATE FUNCTION public.mobility_stage_g262_admin_native_trace_qa(
 _viewer uuid,_kind text,_source uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $g262$
DECLARE
 actor_role text;
 source record;
 timeline jsonb;
 number_events bigint;
 topic text;
BEGIN
 IF _viewer IS NULL OR _source IS NULL OR _kind IS NULL OR
    _kind NOT IN ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')
 THEN RAISE EXCEPTION 'G262 invalid source scope' USING ERRCODE='P6260'; END IF;
 SELECT public.mobility_stage_g27_backoffice_role_of(_viewer) INTO actor_role;
 IF actor_role IS DISTINCT FROM 'admin' THEN
  RAISE EXCEPTION 'G262 exclusive Admin role required' USING ERRCODE='P6261';
 END IF;
 IF _kind IN ('AUTO_RIDE','MOTO_RIDE') THEN
  SELECT t.id,t.request_key,t.passenger_id actor_id,t.driver_id participant_id,
   t.status::text state,t.revision,t.created_at,t.changed_at
   INTO source
  FROM public.mobility_stage_auto_demo_trips t
  WHERE t.id=_source
   AND ((_kind='MOTO_RIDE' AND t.service='moto_pasajero'::public.mobility_service_kind)
    OR (_kind='AUTO_RIDE' AND t.service<>'moto_pasajero'::public.mobility_service_kind));
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO number_events FROM public.mobility_stage_auto_demo_events e
   WHERE e.trip_id=_source;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'eventId',z.id,'revision',z.trip_revision,'status',z.next_status::text,
   'at',z.recorded_at) ORDER BY z.trip_revision),'[]'::jsonb) INTO timeline
  FROM (SELECT e.id,e.trip_revision,e.next_status,e.recorded_at
   FROM public.mobility_stage_auto_demo_events e
   WHERE e.trip_id=_source ORDER BY e.trip_revision LIMIT 64) z;
 ELSIF _kind IN ('DELIVERY_AUTO','DELIVERY_MOTO') THEN
  topic:=CASE WHEN _kind='DELIVERY_AUTO' THEN 'AUTO' ELSE 'MOTO' END;
  SELECT d.id,d.request_key,d.sender_id actor_id,d.courier_id participant_id,
   d.status::text state,d.revision,d.created_at,d.changed_at
   INTO source
  FROM public.mobility_stage_deliveries d
  WHERE d.id=_source AND d.requested_vehicle_kind::text=topic;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO number_events FROM public.mobility_stage_delivery_events e
   WHERE e.delivery_id=_source;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'eventId',z.id,'revision',z.delivery_revision,'status',z.next_status::text,
   'at',z.recorded_at) ORDER BY z.delivery_revision),'[]'::jsonb) INTO timeline
  FROM (SELECT e.id,e.delivery_revision,e.next_status,e.recorded_at
   FROM public.mobility_stage_delivery_events e
   WHERE e.delivery_id=_source ORDER BY e.delivery_revision LIMIT 64) z;
 ELSE
  SELECT o.id,o.request_key,o.buyer_id actor_id,o.delivery_id participant_id,
   o.status::text state,o.revision,o.created_at,o.changed_at
   INTO source
  FROM public.mobility_stage_merchant_orders o
  WHERE o.id=_source;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO number_events FROM public.mobility_stage_merchant_order_events e
   WHERE e.order_id=_source;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'eventId',z.id,'revision',z.order_revision,'status',z.next_status::text,
   'at',z.recorded_at) ORDER BY z.order_revision),'[]'::jsonb) INTO timeline
  FROM (SELECT e.id,e.order_revision,e.next_status,e.recorded_at
   FROM public.mobility_stage_merchant_order_events e
   WHERE e.order_id=_source ORDER BY e.order_revision LIMIT 64) z;
 END IF;
 RETURN jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','serviceKind',_kind,
  'serviceId',source.id,'requestKey',source.request_key,
  'viewerId',_viewer,'actorId',source.actor_id,
  'assignedParticipantOrLinkedDeliveryId',source.participant_id,
  'status',source.state,'revision',source.revision,
  'createdAt',source.created_at,'changedAt',source.changed_at,
  'events',timeline,'totalEvents',number_events,
  'eventsTruncated',number_events>64,'serverPersisted',true,
  'financialReconciliationCertified',false,
  'externalEndToEndCertified',false,'productionEnabled',false
 );
END $g262$;

REVOKE ALL ON FUNCTION public.mobility_stage_g262_admin_native_trace_qa(uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g262_admin_native_trace_qa(uuid,text,uuid)
 TO service_role;
COMMENT ON FUNCTION public.mobility_stage_g262_admin_native_trace_qa(uuid,text,uuid)
 IS 'G262 STAGING native source provenance only; backend verified Admin AAL2 + G27 exclusive role; no settlement or E2E claim.';
