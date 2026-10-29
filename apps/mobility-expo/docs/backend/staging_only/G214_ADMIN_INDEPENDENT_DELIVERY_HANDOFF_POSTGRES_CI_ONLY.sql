-- G214 Admin handoff from original G5+G10+G122+G67+G187, optionally
-- G150 COMMERCE. NEVER infer settlement, real handover, IdP or legal clearance.
-- PG16 qore_disposable_chain ONLY; no remote deployment and no LIVE mutation.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regclass('public.mobility_stage_g187_recipient_confirmations') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g67_delivery_proofs') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_delivery_offers') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g122_delivery_price_consents') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_merchant_orders') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G214 requires disposable original G5 G10 G122 G67 G187 G150'
 USING ERRCODE='P2140'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g214_admin_delivery_handoff_qa(
 _admin uuid,_delivery uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
 WITH stamp AS MATERIALIZED (
  SELECT pg_catalog.floor(pg_catalog.extract(epoch FROM
    pg_catalog.clock_timestamp())*1000)::bigint AS ms
 ), original AS MATERIALIZED (
  SELECT d.*,c.quote_id
  FROM public.mobility_stage_deliveries d
  JOIN public.mobility_stage_g122_delivery_price_consents c
   ON c.delivery_id=d.id AND c.sender_id=d.sender_id
   AND c.vehicle_kind=d.requested_vehicle_kind
  JOIN public.mobility_stage_fare_quotes q
   ON q.id=c.quote_id AND q.customer_id=d.sender_id AND q.subject_id=d.id
   AND q.subject_kind='DELIVERY' AND q.mode='DELIVERY'
   AND q.total_pyg=c.accepted_total_gs
   AND q.provider_pyg+q.commission_pyg=q.total_pyg
  JOIN public.mobility_stage_fare_rules r
   ON r.id=q.rule_id AND r.rule_key=c.accepted_fare_version
   AND r.mode='DELIVERY'
  JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa vk
   ON vk.rule_id=r.id AND vk.vehicle_kind=d.requested_vehicle_kind
  WHERE pg_catalog.current_database()='qore_disposable_chain'
   AND pg_catalog.current_setting('application_name')='qore_ci_disposable_chain'
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
   AND d.id=_delivery AND d.status IN ('delivered','disputed','returned')
   AND d.courier_id IS NOT NULL AND d.courier_id<>d.sender_id
   AND d.vehicle_id IS NOT NULL AND d.proof_ref IS NOT NULL
   AND d.revision=CASE d.status
    WHEN 'delivered' THEN 4 WHEN 'disputed' THEN 5 ELSE 6 END
   AND d.changed_at>=d.created_at
   AND EXISTS (SELECT 1 FROM public.mobility_vehicles v
    WHERE v.id=d.vehicle_id AND v.driver_id=d.courier_id
     AND v.vehicle_kind=d.requested_vehicle_kind)
   AND EXISTS (SELECT 1 FROM public.mobility_stage_delivery_offers offer
    JOIN public.mobility_stage_delivery_events accept_event
     ON accept_event.id=offer.decision_event_id
     AND accept_event.request_key=offer.decision_key
     AND accept_event.delivery_id=d.id
     AND accept_event.actor_id=d.courier_id
     AND accept_event.action='accept'
     AND accept_event.next_status='accepted'
     AND accept_event.delivery_revision=2
    WHERE offer.delivery_id=d.id AND offer.courier_id=d.courier_id
     AND offer.vehicle_id=d.vehicle_id AND offer.status='accepted')
   AND EXISTS (SELECT 1 FROM public.mobility_stage_g67_delivery_proofs proof
    JOIN public.mobility_stage_delivery_events e
     ON e.delivery_id=d.id AND e.actor_id=d.courier_id
     AND e.action='deliver' AND e.next_status='delivered'
     AND e.proof_ref=proof.proof_ref AND e.delivery_revision=4
    WHERE proof.proof_ref=d.proof_ref AND proof.delivery_id=d.id
     AND proof.courier_id=d.courier_id AND proof.revoked_at IS NULL
     AND proof.consumed_at IS NOT NULL)
   AND EXISTS (SELECT 1 FROM public.mobility_stage_delivery_events pick
    WHERE pick.delivery_id=d.id AND pick.actor_id=d.courier_id
     AND pick.action='pickup' AND pick.next_status='picked_up'
     AND pick.delivery_revision=3)
   AND (SELECT count(*) FROM public.mobility_stage_delivery_events ev
     WHERE ev.delivery_id=d.id)=d.revision-1
   AND (d.status='delivered' OR EXISTS(
    SELECT 1 FROM public.mobility_stage_delivery_events dispute
    WHERE dispute.delivery_id=d.id AND dispute.actor_id=d.sender_id
     AND dispute.action='dispute' AND dispute.next_status='disputed'
     AND dispute.delivery_revision=5))
   AND (d.status<>'returned' OR EXISTS(
    SELECT 1 FROM public.mobility_stage_delivery_events returned
    WHERE returned.delivery_id=d.id AND returned.actor_id=d.courier_id
     AND returned.action='return' AND returned.next_status='returned'
     AND returned.delivery_revision=6))
   -- Do not classify a linked COMMERCE delivery when its source is foreign
   -- or not READY. Its original order and immutable G150 event must match.
   AND NOT EXISTS (SELECT 1 FROM public.mobility_stage_merchant_orders bad
    WHERE bad.delivery_id=d.id AND NOT (
      bad.buyer_id=d.sender_id
      AND bad.requested_vehicle_kind=d.requested_vehicle_kind
      AND bad.status='ready' AND bad.revision=5 AND EXISTS (
        SELECT 1 FROM public.mobility_stage_merchant_order_events oe
        WHERE oe.order_id=bad.id AND oe.delivery_id=d.id
         AND oe.action='attach_delivery' AND oe.order_revision=5)))
 ), proof AS MATERIALIZED (
  SELECT o.*,b.binding_key,b.confirmation_key,
   (b.delivery_id IS NOT NULL) AS recipient_bound,
   (b.confirmation_key IS NOT NULL
    AND b.confirmed_delivery_revision=4
    AND b.confirmation_session IS NOT NULL
    AND b.confirmed_at IS NOT NULL AND b.sender_id=o.sender_id
    AND b.recipient_id<>o.sender_id
    AND b.recipient_id<>o.courier_id) AS recipient_confirmed,
   (SELECT linked.id FROM public.mobility_stage_merchant_orders linked
    WHERE linked.delivery_id=o.id LIMIT 1) AS commerce_order_id
  FROM original o
  LEFT JOIN public.mobility_stage_g187_recipient_confirmations b
   ON b.delivery_id=o.id AND b.sender_id=o.sender_id
   AND b.recipient_id<>o.courier_id AND b.recipient_id<>o.sender_id
  WHERE NOT EXISTS (SELECT 1 FROM public.mobility_stage_g187_recipient_confirmations invalid
   WHERE invalid.delivery_id=o.id AND (
    invalid.sender_id<>o.sender_id OR invalid.recipient_id=o.sender_id
    OR invalid.recipient_id=o.courier_id
    OR (invalid.confirmation_key IS NOT NULL AND
        (invalid.confirmed_delivery_revision<>4 OR invalid.confirmed_at IS NULL))))
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','viewerId',_admin,
  'serviceId',s.id,'serviceKind',CASE
   WHEN s.requested_vehicle_kind='AUTO' THEN 'DELIVERY_AUTO'
   ELSE 'DELIVERY_MOTO' END,
  'bookingRequestKey',s.request_key,'quoteId',s.quote_id,
  'deliveryState',s.status::text,'revision',s.revision,
  'courierAccepted',true,'courierProofCommitted',true,
  'recipientBound',s.recipient_bound,
  'recipientConfirmed',s.recipient_confirmed,
  'eligibleForSettlement',(
   s.status='delivered' AND s.recipient_confirmed),
  'paymentAuthorized',false,'commerciallyCertified',false,
  'legalGate','EXTERNAL_NOT_CERTIFIED',
  'commerceOrderId',s.commerce_order_id,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true,'qaOnly',true,'productionEnabled',false)
 FROM proof s CROSS JOIN stamp
 LIMIT 1
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g214_admin_delivery_handoff_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g214_admin_delivery_handoff_qa(uuid,uuid)
 TO service_role;
COMMIT;
