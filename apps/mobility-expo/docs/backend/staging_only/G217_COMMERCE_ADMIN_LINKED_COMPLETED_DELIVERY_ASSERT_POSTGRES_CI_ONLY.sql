-- G217 regression: original G139/G148/G150 priced COMMERCE remains
-- visible through Admin's independent G146 read after G216 upgrade.
-- A linked shipment is NOT assumed delivered without G216. No fake PSP.
DO $guard$ DECLARE
 admin_user uuid:='14500000-0000-4145-8145-000000000002';
 ord record; dto jsonb;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR has_function_privilege('anon',
  'public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G217 unsafe PG16 or Admin function grants'; END IF;
 SELECT o.id,o.request_key,o.delivery_id INTO ord
 FROM public.mobility_stage_merchant_orders o
 JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id
 JOIN public.mobility_stage_g122_delivery_price_consents c
  ON c.delivery_id=d.id AND c.sender_id=d.sender_id
 WHERE o.request_key='13800000-0000-4138-8138-000000000242'::uuid
  AND o.status='ready' AND o.revision=5
  AND d.status='requested' AND d.requested_vehicle_kind='MOTO'
 LIMIT 1;
 IF ord.id IS NULL OR ord.delivery_id IS NULL THEN
  RAISE EXCEPTION 'G217 missing original linked Commerce price consent'; END IF;
 dto:=public.mobility_stage_g146_commerce_trace_qa(admin_user,ord.id);
 IF dto IS NULL
 OR dto->>'serviceId'<>ord.id::text
 OR dto->>'deliveryId'<>ord.delivery_id::text
 OR dto->>'bookingRequestKey'<>ord.request_key::text
 OR dto->>'status'<>'ready'
 OR (dto->>'revision')::integer<>5
 OR dto->>'productionEnabled'<>'false'
 OR dto->'ledger'<>'null'::jsonb
 THEN RAISE EXCEPTION 'G217 mutated original linked commerce receipt: %',dto; END IF;
 IF public.mobility_stage_g216_completed_delivery_trace_qa(
  admin_user,ord.delivery_id) IS NOT NULL
 THEN RAISE EXCEPTION 'G217 inferred a delivered shipment from ready merchant'; END IF;
 IF public.mobility_stage_g146_commerce_trace_qa(
  '13800000-0000-4138-8138-000000000001'::uuid,ord.id) IS NOT NULL
 THEN RAISE EXCEPTION 'G217 Buyer impersonated Admin'; END IF;
 RAISE NOTICE 'G217 PASS: original commerce order remains linked to actual G150 price-consented G5, no fake delivered/PSP, Admin exclusive';
END $guard$;
