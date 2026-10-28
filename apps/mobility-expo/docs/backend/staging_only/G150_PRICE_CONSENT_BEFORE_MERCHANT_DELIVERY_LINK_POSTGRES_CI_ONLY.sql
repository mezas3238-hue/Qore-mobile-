-- G150: G6 order ready -> G5 exact original delivery, requiring G122
-- immutable sender price consent & fare/vehicle provenance. PostgreSQL 16 CI ONLY.
-- An unpriced draft can NEVER link to a ready order or authorize dispatch.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regclass('public.mobility_stage_g122_delivery_price_consents') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g122_delivery_rate_vehicle_qa') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_merchant_orders') IS NULL
 THEN RAISE EXCEPTION 'G150 refuses non-disposable or incomplete price chain'; END IF;
END $guard$;
BEGIN;
CREATE OR REPLACE FUNCTION public.mobility_stage_merchant_order_attach_delivery(
 _order_id uuid,_actor_id uuid,_delivery_id uuid,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE o public.mobility_stage_merchant_orders%ROWTYPE;
 d public.mobility_stage_deliveries%ROWTYPE;
 old public.mobility_stage_merchant_order_events%ROWTYPE;
 event_id uuid; ver bigint; staff_allowed boolean;
 expected_pickup text;
 expected_category public.mobility_stage_delivery_category;
BEGIN
 IF _order_id IS NULL OR _actor_id IS NULL OR _delivery_id IS NULL OR _request_key IS NULL
 THEN RAISE EXCEPTION 'Invalid merchant delivery link'; END IF;
 SELECT * INTO o FROM public.mobility_stage_merchant_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Merchant order not found'; END IF;
 SELECT * INTO old FROM public.mobility_stage_merchant_order_events WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.order_id<>_order_id OR old.actor_id<>_actor_id
   OR old.action<>'attach_delivery' OR old.delivery_id<>_delivery_id
  THEN RAISE EXCEPTION 'Conflicting merchant delivery replay'; END IF;
  RETURN old.id;
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.mobility_stage_merchant_staff s
  WHERE s.merchant_id=o.merchant_id AND s.user_id=_actor_id AND s.active=true)
 INTO staff_allowed;
 SELECT * INTO d FROM public.mobility_stage_deliveries WHERE id=_delivery_id FOR UPDATE;
 SELECT b.pickup_tag,CASE m.kind
   WHEN 'SUPERMARKET' THEN 'GROCERIES'::public.mobility_stage_delivery_category
   WHEN 'PHARMACY' THEN 'PHARMACY_OTC'::public.mobility_stage_delivery_category
   WHEN 'RESTAURANT' THEN 'RESTAURANT'::public.mobility_stage_delivery_category
   ELSE 'PARCEL'::public.mobility_stage_delivery_category END
 INTO expected_pickup,expected_category
 FROM public.mobility_stage_merchant_branches b
 JOIN public.mobility_stage_merchants m ON m.id=b.merchant_id
 WHERE b.id=o.branch_id;
 IF o.status<>'ready' OR o.delivery_id IS NOT NULL OR NOT staff_allowed OR d.id IS NULL
  OR d.sender_id<>o.buyer_id OR d.requested_vehicle_kind<>o.requested_vehicle_kind
  OR d.pickup_tag<>expected_pickup OR d.category<>expected_category
  OR d.status<>'requested' OR d.courier_id IS NOT NULL
  OR d.vehicle_id IS NOT NULL OR d.proof_ref IS NOT NULL
  OR NOT EXISTS (
   SELECT 1
   FROM public.mobility_stage_g122_delivery_price_consents c
   JOIN public.mobility_stage_fare_quotes q ON q.id=c.quote_id
   JOIN public.mobility_stage_fare_rules r ON r.id=q.rule_id
   JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa v ON v.rule_id=r.id
   WHERE c.delivery_id=d.id
    AND c.sender_id=o.buyer_id AND c.vehicle_kind=o.requested_vehicle_kind
    AND v.vehicle_kind=o.requested_vehicle_kind
    AND q.customer_id=o.buyer_id AND q.subject_id=d.id
    AND q.subject_kind='DELIVERY' AND q.mode='DELIVERY'
    AND q.total_pyg=c.accepted_total_gs
    AND q.provider_pyg+q.commission_pyg=q.total_pyg
    AND r.rule_key=c.accepted_fare_version AND r.mode='DELIVERY'
    AND c.accepted_total_gs>0
  )
 THEN RAISE EXCEPTION 'G150 original delivery price consent or cargo proof missing'; END IF;
 UPDATE public.mobility_stage_merchant_orders SET delivery_id=d.id,
  revision=revision+1,changed_at=now() WHERE id=o.id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_merchant_order_events
  (request_key,order_id,actor_id,action,next_status,order_revision,delivery_id)
 VALUES(_request_key,o.id,_actor_id,'attach_delivery','ready',ver,d.id)
 RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;
COMMIT;
