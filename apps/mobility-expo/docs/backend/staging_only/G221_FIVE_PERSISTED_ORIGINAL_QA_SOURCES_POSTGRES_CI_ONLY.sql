-- G221: bind ONE independently selected immutable set of five ORIGINAL
-- source records to a strict G202/G215 readback in a disposable PG16 CI DB.
-- These are synthetic-acceptance QA transactions, deliberately COMMITTED
-- only to the database which GitHub Actions destroys after its job.
-- Never migrate to staging, Supabase, LIVE or any other database.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g142_moto_trace_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G221 cannot publish outside isolated PG16 QA'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g221_five_original_qa_sources (
 service_kind text PRIMARY KEY CHECK(service_kind IN(
  'AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')),
 service_id uuid NOT NULL UNIQUE,
 request_key uuid NOT NULL UNIQUE,
 source_status text NOT NULL,
 linked_delivery_id uuid,
 acceptance_evidence text NOT NULL
  CHECK(acceptance_evidence='CI_SYNTHETIC_ONLY_NOT_LEGAL'),
 external_legal_certified boolean NOT NULL DEFAULT false
  CHECK(external_legal_certified=false),
 production_enabled boolean NOT NULL DEFAULT false
  CHECK(production_enabled=false)
);
ALTER TABLE public.mobility_stage_g221_five_original_qa_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g221_five_original_qa_sources
 FROM PUBLIC,anon,authenticated,service_role;

INSERT INTO public.mobility_stage_g221_five_original_qa_sources(
 service_kind,service_id,request_key,source_status,acceptance_evidence)
SELECT 'AUTO_RIDE',t.id,t.request_key,t.status::text,'CI_SYNTHETIC_ONLY_NOT_LEGAL'
FROM public.mobility_stage_auto_demo_trips t
WHERE t.request_key='22000000-0000-4220-8220-000000000031'::uuid
 AND t.status='completed' AND t.revision=5
 AND EXISTS(SELECT 1 FROM public.mobility_stage_g72_auto_prequotes q
  JOIN public.mobility_stage_g73_auto_routes r ON r.id=q.route_id
  WHERE q.trip_id=t.id AND q.booking_key=t.request_key
   AND q.passenger_id=t.passenger_id AND r.passenger_id=t.passenger_id);

INSERT INTO public.mobility_stage_g221_five_original_qa_sources(
 service_kind,service_id,request_key,source_status,acceptance_evidence)
SELECT 'MOTO_RIDE',t.id,t.booking_key,t.status,'CI_SYNTHETIC_ONLY_NOT_LEGAL'
FROM public.mobility_stage_g100_moto_trips t
WHERE t.booking_key='22000000-0000-4220-8220-000000000032'::uuid
 AND t.status='completed' AND t.revision=5
 AND t.accepted_offer_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.mobility_stage_g118_moto_offers o
  WHERE o.id=t.accepted_offer_id AND o.status='accepted'
   AND o.trip_id=t.id AND o.driver_id=t.driver_id);

INSERT INTO public.mobility_stage_g221_five_original_qa_sources(
 service_kind,service_id,request_key,source_status,acceptance_evidence)
SELECT 'DELIVERY_'||d.requested_vehicle_kind::text,
 d.id,d.request_key,d.status::text,'CI_SYNTHETIC_ONLY_NOT_LEGAL'
FROM public.mobility_stage_deliveries d
JOIN public.mobility_stage_g122_delivery_price_consents c
 ON c.delivery_id=d.id AND c.sender_id=d.sender_id
 AND c.vehicle_kind=d.requested_vehicle_kind
WHERE d.status='delivered' AND d.revision=4
 AND d.sender_id IN(
  '12200000-0000-4122-8122-000000000011'::uuid,
  '12200000-0000-4122-8122-000000000012'::uuid)
 AND public.mobility_stage_g216_completed_delivery_trace_qa(
  '14500000-0000-4145-8145-000000000002'::uuid,d.id) IS NOT NULL;

INSERT INTO public.mobility_stage_g221_five_original_qa_sources(
 service_kind,service_id,request_key,source_status,linked_delivery_id,
 acceptance_evidence)
SELECT 'COMMERCE',o.id,o.request_key,o.status::text,o.delivery_id,
 'CI_SYNTHETIC_ONLY_NOT_LEGAL'
FROM public.mobility_stage_merchant_orders o
JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id
WHERE o.request_key='13800000-0000-4138-8138-000000000242'::uuid
 AND o.status='ready' AND o.revision=5
 AND d.status='delivered'
 AND public.mobility_stage_g216_completed_delivery_trace_qa(
  '14500000-0000-4145-8145-000000000002'::uuid,d.id) IS NOT NULL
 AND public.mobility_stage_g146_commerce_trace_qa(
  '14500000-0000-4145-8145-000000000002'::uuid,o.id) IS NOT NULL;

DO $assert$
DECLARE kinds text[];
BEGIN
 SELECT array_agg(service_kind ORDER BY service_kind) INTO kinds
 FROM public.mobility_stage_g221_five_original_qa_sources;
 IF kinds IS DISTINCT FROM ARRAY[
  'AUTO_RIDE','COMMERCE','DELIVERY_AUTO','DELIVERY_MOTO','MOTO_RIDE']::text[]
 OR EXISTS(SELECT 1 FROM public.mobility_stage_g221_five_original_qa_sources
  WHERE external_legal_certified OR production_enabled
  OR acceptance_evidence<>'CI_SYNTHETIC_ONLY_NOT_LEGAL')
 THEN RAISE EXCEPTION 'G221 must verify exactly five distinct original QA source IDs, never commercial'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.mobility_stage_g221_five_original_qa_sources m
  JOIN public.mobility_stage_g221_five_original_qa_sources d
    ON d.service_kind='DELIVERY_MOTO' AND d.service_id=m.linked_delivery_id
  WHERE m.service_kind='COMMERCE')
 THEN RAISE EXCEPTION 'G221 duplicate cargo/commerce delivery counted as two independent cargo source IDs'; END IF;
 RAISE NOTICE 'G221 committed exactly five distinct original-source QA records in disposable PostgreSQL16; external certification remains zero';
END $assert$;
COMMIT;
