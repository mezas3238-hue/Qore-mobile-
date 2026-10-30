-- G216: an Admin must be able to observe a COMPLETE ORIGINAL priced G5 delivery
-- only AFTER G10 private accepted offer, G67 courier attestation consumed inside
-- G5 commit, and G187 independent recipient acknowledgment. CI ONLY.
-- This does not create, bypass or attest real municipal, GPS, PSP authority.
DO $gate$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g145_delivery_trace_qa(uuid,uuid)') IS NULL
 OR to_regclass('public.mobility_stage_g67_delivery_proofs') IS NULL
 OR to_regclass('public.mobility_stage_g187_recipient_confirmations') IS NULL
 OR to_regclass('public.mobility_stage_delivery_offers') IS NULL
 THEN RAISE EXCEPTION 'G216 requires disposable G145/G67/G187 original sources'; END IF;
END $gate$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g216_completed_delivery_trace_qa(
 _admin uuid,_delivery uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
 WITH stamp AS MATERIALIZED (
  SELECT pg_catalog.floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint ms
 ), source AS MATERIALIZED (
  SELECT d.id,d.request_key,d.sender_id,d.courier_id,d.vehicle_id,
    d.requested_vehicle_kind,d.status,d.revision,d.created_at,d.changed_at,
    c.quote_id,o.decision_event_id,d.proof_ref
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
  JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa v
   ON v.rule_id=r.id AND v.vehicle_kind=d.requested_vehicle_kind
  JOIN public.mobility_stage_delivery_offers o
   ON o.delivery_id=d.id AND o.courier_id=d.courier_id
    AND o.vehicle_id=d.vehicle_id AND o.status='accepted'
    AND o.decision_key IS NOT NULL AND o.decision_event_id IS NOT NULL
  JOIN public.mobility_stage_g67_delivery_proofs proof
   ON proof.proof_ref=d.proof_ref AND proof.delivery_id=d.id
    AND proof.courier_id=d.courier_id
    AND proof.consumed_at IS NOT NULL AND proof.revoked_at IS NULL
    AND proof.provider_kind='QA_SERVER_ATTESTED_NO_CONTENT'
  JOIN public.mobility_stage_g187_recipient_confirmations receipt
   ON receipt.delivery_id=d.id AND receipt.sender_id=d.sender_id
    AND receipt.recipient_id<>d.sender_id
    AND receipt.recipient_id<>d.courier_id
    AND receipt.confirmation_key IS NOT NULL
    AND receipt.confirmation_session IS NOT NULL
    AND receipt.confirmed_at IS NOT NULL
    AND receipt.confirmed_delivery_revision=d.revision
  WHERE pg_catalog.current_database()='qore_disposable_chain'
   AND pg_catalog.current_setting('application_name')='qore_ci_disposable_chain'
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
   AND d.id=_delivery AND d.status='delivered' AND d.revision=4
   AND d.courier_id IS NOT NULL AND d.vehicle_id IS NOT NULL
   AND d.proof_ref IS NOT NULL
   AND d.sender_id<>d.courier_id
   AND d.changed_at>=d.created_at
   AND c.confirmed_at<=o.offered_at
 ), timeline AS MATERIALIZED (
  SELECT s.id,pg_catalog.count(*) AS n,
   pg_catalog.count(*) FILTER(WHERE e.actor_id=s.courier_id) AS courier_events,
   pg_catalog.count(*) FILTER(WHERE e.action='accept' AND
     e.next_status='accepted' AND e.delivery_revision=2 AND
     e.id=s.decision_event_id AND e.proof_ref IS NULL) AS accepted,
   pg_catalog.count(*) FILTER(WHERE e.action='pickup' AND
     e.next_status='picked_up' AND e.delivery_revision=3 AND
     e.proof_ref IS NULL) AS picked,
   pg_catalog.count(*) FILTER(WHERE e.action='deliver' AND
     e.next_status='delivered' AND e.delivery_revision=4 AND
     e.proof_ref=s.proof_ref) AS delivered,
   pg_catalog.min(e.recorded_at) FILTER(WHERE e.delivery_revision=2) AS accepted_at,
   pg_catalog.min(e.recorded_at) FILTER(WHERE e.delivery_revision=3) AS picked_at,
   pg_catalog.min(e.recorded_at) FILTER(WHERE e.delivery_revision=4) AS delivered_at,
   pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'eventId',e.id,'serviceId',e.delivery_id,
    'sequence',e.delivery_revision,'status',e.next_status::text,
    'at',pg_catalog.floor(extract(epoch FROM e.recorded_at)*1000)::bigint
   ) ORDER BY e.delivery_revision) AS steps
  FROM source s JOIN public.mobility_stage_delivery_events e
    ON e.delivery_id=s.id
  GROUP BY s.id
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','viewerId',_admin,
  'serviceId',s.id,'serviceKind',CASE
   WHEN s.requested_vehicle_kind='AUTO' THEN 'DELIVERY_AUTO'
   ELSE 'DELIVERY_MOTO' END,
  'bookingRequestKey',s.request_key,'quoteId',s.quote_id,
  'status','delivered','revision',4,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true,'productionEnabled',false,
  'assignment',pg_catalog.jsonb_build_object(
   'state','QA_COMPLETED','legalGate','EXTERNAL_NOT_CERTIFIED'),
  'events',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'eventId',s.id,'serviceId',s.id,'sequence',1,'status','requested',
    'at',pg_catalog.floor(extract(epoch FROM s.created_at)*1000)::bigint
   ))||t.steps,
  'ledger',NULL)
 FROM source s JOIN timeline t ON t.id=s.id CROSS JOIN stamp
 WHERE t.n=3 AND t.courier_events=3
  AND t.accepted=1 AND t.picked=1 AND t.delivered=1
  AND s.created_at<=t.accepted_at
  AND t.accepted_at<=t.picked_at AND t.picked_at<=t.delivered_at
  AND t.delivered_at<=pg_catalog.clock_timestamp()
 LIMIT 1
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g216_completed_delivery_trace_qa(
 uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g216_completed_delivery_trace_qa(
 uuid,uuid) TO service_role;
COMMIT;
