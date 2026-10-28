-- G154: a G5 delivery originating at a registered COMMERCE branch must
-- NOT be offered/assigned before the ORIGINAL G45 Buyer order is READY,
-- has an immutable G150 price-consented delivery link and original event.
-- This supplements G123/G71/G38, NEVER grants legal courier clearance.
-- Disposable PostgreSQL16 CI ONLY; no remote execution or LIVE.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g123_delivery_priced_qa(uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g45_order_receipts') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_merchant_order_lines') IS NULL
 THEN RAISE EXCEPTION 'G154 refuses non-disposable/incomplete COMMERCE/Driver chain'; END IF;
END $guard$;
BEGIN;

CREATE FUNCTION public.mobility_stage_g154_merchant_dispatch_ready_qa(_delivery uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 commerce_pickup boolean;
BEGIN
 SELECT * INTO d FROM public.mobility_stage_deliveries WHERE id=_delivery;
 IF NOT FOUND OR d.status<>'requested' OR d.courier_id IS NOT NULL
 OR d.vehicle_id IS NOT NULL OR d.proof_ref IS NOT NULL THEN RETURN false; END IF;

 -- A normal peer-to-peer parcel is not required to have a merchant order.
 -- Recognize registered merchant-origin pickups irrespective of suspension:
 -- suspension must not silently turn a COMMERCE parcel into generic cargo.
 SELECT EXISTS (
  SELECT 1 FROM public.mobility_stage_merchant_branches b
  JOIN public.mobility_stage_merchants m ON m.id=b.merchant_id
  WHERE b.pickup_tag=d.pickup_tag
  AND d.category=CASE m.kind
    WHEN 'SUPERMARKET' THEN 'GROCERIES'::public.mobility_stage_delivery_category
    WHEN 'PHARMACY' THEN 'PHARMACY_OTC'::public.mobility_stage_delivery_category
    WHEN 'RESTAURANT' THEN 'RESTAURANT'::public.mobility_stage_delivery_category
    ELSE 'PARCEL'::public.mobility_stage_delivery_category END
 ) INTO commerce_pickup;
 IF NOT commerce_pickup THEN RETURN true; END IF;

 RETURN EXISTS (
  SELECT 1 FROM public.mobility_stage_merchant_orders o
  JOIN public.mobility_stage_merchant_branches b
   ON b.id=o.branch_id AND b.merchant_id=o.merchant_id
  JOIN public.mobility_stage_merchants m ON m.id=o.merchant_id
  JOIN public.mobility_stage_g45_order_receipts r
   ON r.order_id=o.id AND r.buyer_id=o.buyer_id
    AND r.branch_id=o.branch_id AND r.request_key=o.request_key
    AND r.subtotal_pyg=o.subtotal_pyg
    AND r.requested_vehicle_kind=o.requested_vehicle_kind
  JOIN public.mobility_stage_merchant_order_events e
   ON e.order_id=o.id AND e.delivery_id=d.id
    AND e.action='attach_delivery' AND e.next_status='ready'
    AND e.order_revision=o.revision
  WHERE o.delivery_id=d.id AND o.buyer_id=d.sender_id
   AND o.requested_vehicle_kind=d.requested_vehicle_kind
   AND o.status='ready' AND o.revision=5
   AND m.status='approved' AND b.active=true
   AND b.pickup_tag=d.pickup_tag
   AND d.category=CASE m.kind
     WHEN 'SUPERMARKET' THEN 'GROCERIES'::public.mobility_stage_delivery_category
     WHEN 'PHARMACY' THEN 'PHARMACY_OTC'::public.mobility_stage_delivery_category
     WHEN 'RESTAURANT' THEN 'RESTAURANT'::public.mobility_stage_delivery_category
     ELSE 'PARCEL'::public.mobility_stage_delivery_category END
   AND EXISTS (SELECT 1 FROM public.mobility_stage_merchant_order_lines l
    WHERE l.order_id=o.id)
   AND d.grams>=COALESCE((
    SELECT pg_catalog.sum(l.quantity::bigint*l.unit_grams::bigint)
    FROM public.mobility_stage_merchant_order_lines l
    WHERE l.order_id=o.id),0)
   AND EXISTS (SELECT 1
    FROM public.mobility_stage_g122_delivery_price_consents c
    JOIN public.mobility_stage_fare_quotes q
     ON q.id=c.quote_id AND q.subject_id=d.id AND q.customer_id=o.buyer_id
      AND q.subject_kind='DELIVERY' AND q.mode='DELIVERY'
      AND q.total_pyg=c.accepted_total_gs
    JOIN public.mobility_stage_fare_rules fare
     ON fare.id=q.rule_id AND fare.rule_key=c.accepted_fare_version
      AND fare.mode='DELIVERY'
    JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa bound
     ON bound.rule_id=fare.id AND bound.vehicle_kind=d.requested_vehicle_kind
    WHERE c.delivery_id=d.id AND c.sender_id=d.sender_id
     AND c.vehicle_kind=d.requested_vehicle_kind)
 );
END $f$;

-- Backend G10 inserts offers only after it locks and verifies Driver G71.
-- This extra trigger applies EVEN to a legacy service-role/owner offer path.
CREATE FUNCTION public.mobility_stage_g154_commerce_offer_fence()
 RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF TG_OP<>'INSERT' OR TG_TABLE_SCHEMA<>'public'
 OR TG_TABLE_NAME<>'mobility_stage_delivery_offers'
 OR NOT public.mobility_stage_g154_merchant_dispatch_ready_qa(NEW.delivery_id)
 THEN RAISE EXCEPTION 'G154 original merchant order readiness required'
  USING ERRCODE='P1541'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER b11_g154_commerce_offer_ready
 BEFORE INSERT ON public.mobility_stage_delivery_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g154_commerce_offer_fence();

-- Re-evaluate before assignment: a once valid private offer is NOT proof
-- the original merchant is still authorized at the acceptance instant.
CREATE FUNCTION public.mobility_stage_g154_commerce_assignment_fence()
 RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public'
 OR TG_TABLE_NAME<>'mobility_stage_deliveries'
 THEN RAISE EXCEPTION 'G154 invalid assignment trigger' USING ERRCODE='P1541'; END IF;
 IF OLD.status='requested' AND NEW.status='accepted'
 AND NOT public.mobility_stage_g154_merchant_dispatch_ready_qa(OLD.id)
 THEN RAISE EXCEPTION 'G154 original merchant order unready at assignment'
  USING ERRCODE='P1541'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER b11_g154_commerce_assignment_ready
 BEFORE UPDATE OF status,courier_id,vehicle_id ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g154_commerce_assignment_fence();

REVOKE ALL ON FUNCTION public.mobility_stage_g154_merchant_dispatch_ready_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g154_commerce_offer_fence()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g154_commerce_assignment_fence()
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
