-- QORE G6: merchant catalog, inventory, preparation and delivery linkage.
-- POSTGRESQL 16 DISPOSABLE CI ONLY. NEVER deploy remotely or enable LIVE.
-- Requires G1 identities and G5 delivery custody.
BEGIN;

CREATE TYPE public.mobility_stage_merchant_kind AS ENUM
 ('SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER');
CREATE TYPE public.mobility_stage_merchant_status AS ENUM
 ('pending','approved','suspended');
CREATE TYPE public.mobility_stage_merchant_staff_role AS ENUM
 ('owner','manager','picker');
CREATE TYPE public.mobility_stage_catalog_class AS ENUM
 ('GENERAL','PHARMACY_OTC');
CREATE TYPE public.mobility_stage_order_status AS ENUM
 ('requested','confirmed','preparing','ready','handed_to_courier','delivered','cancelled');

CREATE TABLE public.mobility_stage_merchants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 onboarding_key uuid NOT NULL UNIQUE,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 kind public.mobility_stage_merchant_kind NOT NULL,
 display_tag text NOT NULL CHECK(display_tag ~ '^[A-Z_]{3,40}$'),
 status public.mobility_stage_merchant_status NOT NULL DEFAULT 'pending',
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
   OR (status IN ('approved','suspended') AND reviewed_by IS NOT NULL
       AND reviewed_at IS NOT NULL))
);
CREATE TABLE public.mobility_stage_merchant_staff (
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 staff_role public.mobility_stage_merchant_staff_role NOT NULL,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(merchant_id,user_id)
);
CREATE TABLE public.mobility_stage_merchant_branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 branch_tag text NOT NULL CHECK(branch_tag ~ '^[A-Z_]{3,40}$'),
 pickup_tag text NOT NULL CHECK(pickup_tag ~ '^[A-Z_]{3,40}$'),
 active boolean NOT NULL DEFAULT true,
 accepting_orders boolean NOT NULL DEFAULT false,
 preparation_minutes integer NOT NULL CHECK(preparation_minutes BETWEEN 1 AND 180),
 UNIQUE(merchant_id,branch_tag)
);
CREATE TABLE public.mobility_stage_catalog_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 branch_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_branches(id) ON DELETE RESTRICT,
 sku text NOT NULL CHECK(sku ~ '^[A-Z0-9_-]{2,40}$'),
 item_tag text NOT NULL CHECK(item_tag ~ '^[A-Z0-9_]{2,50}$'),
 item_class public.mobility_stage_catalog_class NOT NULL DEFAULT 'GENERAL',
 unit_price_pyg integer NOT NULL CHECK(unit_price_pyg BETWEEN 100 AND 10000000),
 unit_grams integer NOT NULL CHECK(unit_grams BETWEEN 1 AND 50000),
 stock_units integer NOT NULL CHECK(stock_units BETWEEN 0 AND 1000000),
 active boolean NOT NULL DEFAULT true,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(branch_id,sku)
);
CREATE TABLE public.mobility_stage_merchant_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 branch_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_branches(id) ON DELETE RESTRICT,
 requested_vehicle_kind public.mobility_vehicle_kind NOT NULL,
 items_request jsonb NOT NULL,
 subtotal_pyg integer NOT NULL CHECK(subtotal_pyg BETWEEN 100 AND 50000000),
 status public.mobility_stage_order_status NOT NULL DEFAULT 'requested',
 delivery_id uuid UNIQUE REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(items_request)='array'),
 CHECK((status IN ('requested','confirmed','preparing','cancelled') AND delivery_id IS NULL)
   OR status='ready'
   OR (status IN ('handed_to_courier','delivered') AND delivery_id IS NOT NULL))
);
CREATE UNIQUE INDEX mobility_stage_one_active_merchant_order_buyer
 ON public.mobility_stage_merchant_orders(buyer_id)
 WHERE status IN ('requested','confirmed','preparing','ready','handed_to_courier');
CREATE TABLE public.mobility_stage_merchant_order_lines (
 order_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_orders(id) ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES public.mobility_stage_catalog_items(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 999),
 unit_price_pyg integer NOT NULL CHECK(unit_price_pyg BETWEEN 100 AND 10000000),
 line_total_pyg integer NOT NULL CHECK(line_total_pyg BETWEEN 100 AND 50000000),
 unit_grams integer NOT NULL CHECK(unit_grams BETWEEN 1 AND 50000),
 PRIMARY KEY(order_id,item_id),
 CHECK(line_total_pyg=quantity*unit_price_pyg)
);
CREATE TABLE public.mobility_stage_merchant_order_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 order_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_orders(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN
  ('confirm','start_preparing','ready','cancel','attach_delivery','hand_to_courier','complete')),
 next_status public.mobility_stage_order_status NOT NULL,
 order_revision bigint NOT NULL CHECK(order_revision>1),
 delivery_id uuid REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,order_revision)
);

ALTER TABLE public.mobility_stage_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_merchant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_merchant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_merchant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_merchant_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_merchant_order_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchants FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_merchant_staff FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_merchant_branches FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_catalog_items FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_merchant_orders FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_merchant_order_lines FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_merchant_order_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchants TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchant_staff TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchant_branches TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_catalog_items TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchant_orders TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_merchant_order_lines TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_merchant_order_events TO service_role;
GRANT SELECT ON public.mobility_stage_merchants,public.mobility_stage_merchant_staff,
 public.mobility_stage_merchant_branches,
 public.mobility_stage_catalog_items,public.mobility_stage_merchant_orders,
 public.mobility_stage_merchant_order_lines TO authenticated;
CREATE POLICY mobility_stage_approved_merchant_read ON public.mobility_stage_merchants
 FOR SELECT TO authenticated USING(status='approved');
CREATE POLICY mobility_stage_own_staff_membership_read ON public.mobility_stage_merchant_staff
 FOR SELECT TO authenticated USING(user_id=auth.uid() AND active=true);
CREATE POLICY mobility_stage_active_branch_read ON public.mobility_stage_merchant_branches
 FOR SELECT TO authenticated USING(active=true AND accepting_orders=true AND EXISTS(
  SELECT 1 FROM public.mobility_stage_merchants m
  WHERE m.id=merchant_id AND m.status='approved'));
CREATE POLICY mobility_stage_active_catalog_read ON public.mobility_stage_catalog_items
 FOR SELECT TO authenticated USING(active=true AND stock_units>0 AND EXISTS(
  SELECT 1 FROM public.mobility_stage_merchant_branches b
  JOIN public.mobility_stage_merchants m ON m.id=b.merchant_id
  WHERE b.id=branch_id AND b.active=true AND b.accepting_orders=true
    AND m.status='approved'));
CREATE POLICY mobility_stage_order_participant_read ON public.mobility_stage_merchant_orders
 FOR SELECT TO authenticated USING(buyer_id=auth.uid() OR EXISTS(
  SELECT 1 FROM public.mobility_stage_merchant_staff s
  WHERE s.merchant_id=merchant_id AND s.user_id=auth.uid() AND s.active=true));
CREATE POLICY mobility_stage_order_line_participant_read ON public.mobility_stage_merchant_order_lines
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.mobility_stage_merchant_orders o
  WHERE o.id=order_id AND (o.buyer_id=auth.uid() OR EXISTS(
   SELECT 1 FROM public.mobility_stage_merchant_staff s
   WHERE s.merchant_id=o.merchant_id AND s.user_id=auth.uid() AND s.active=true))));

CREATE FUNCTION public.mobility_stage_merchant_order_request(
 _buyer_id uuid,_request_key uuid,_branch_id uuid,
 _vehicle_kind public.mobility_vehicle_kind,_items jsonb
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE old public.mobility_stage_merchant_orders%ROWTYPE;
 branch public.mobility_stage_merchant_branches%ROWTYPE;
 merchant public.mobility_stage_merchants%ROWTYPE;
 item public.mobility_stage_catalog_items%ROWTYPE;
 element jsonb; item_id uuid; qty integer; out_id uuid;
 subtotal bigint:=0; item_count integer:=0;
BEGIN
 IF _buyer_id IS NULL OR _request_key IS NULL OR _branch_id IS NULL
 OR _vehicle_kind IS NULL OR _items IS NULL OR jsonb_typeof(_items)<>'array'
 OR jsonb_array_length(_items) NOT BETWEEN 1 AND 50
 THEN RAISE EXCEPTION 'Invalid merchant order request'; END IF;
 SELECT * INTO old FROM public.mobility_stage_merchant_orders WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.buyer_id<>_buyer_id OR old.branch_id<>_branch_id
   OR old.requested_vehicle_kind<>_vehicle_kind OR old.items_request<>_items
  THEN RAISE EXCEPTION 'Conflicting merchant order request key'; END IF;
  RETURN old.id;
 END IF;
 SELECT * INTO branch FROM public.mobility_stage_merchant_branches
  WHERE id=_branch_id FOR UPDATE;
 IF NOT FOUND OR NOT branch.active OR NOT branch.accepting_orders
 THEN RAISE EXCEPTION 'Merchant branch unavailable'; END IF;
 SELECT * INTO merchant FROM public.mobility_stage_merchants
  WHERE id=branch.merchant_id;
 IF NOT FOUND OR merchant.status<>'approved' OR merchant.owner_id=_buyer_id
 THEN RAISE EXCEPTION 'Merchant unavailable to buyer'; END IF;
 INSERT INTO public.mobility_stage_merchant_orders
  (request_key,buyer_id,merchant_id,branch_id,requested_vehicle_kind,
   items_request,subtotal_pyg)
 VALUES(_request_key,_buyer_id,merchant.id,branch.id,_vehicle_kind,_items,100)
 RETURNING id INTO out_id;
 FOR element IN SELECT value FROM jsonb_array_elements(_items) LOOP
  IF jsonb_typeof(element)<>'object'
   OR (element-'itemId'-'quantity')<>'{}'::jsonb
   OR NOT element ? 'itemId' OR NOT element ? 'quantity'
   OR (element->>'quantity') !~ '^[1-9][0-9]{0,2}$'
  THEN RAISE EXCEPTION 'Invalid merchant order line'; END IF;
  item_id:=(element->>'itemId')::uuid;
  qty:=(element->>'quantity')::integer;
  SELECT * INTO item FROM public.mobility_stage_catalog_items
   WHERE id=item_id FOR UPDATE;
  IF NOT FOUND OR item.branch_id<>branch.id OR NOT item.active OR item.stock_units<qty
  THEN RAISE EXCEPTION 'Catalog item unavailable'; END IF;
  IF item.item_class='PHARMACY_OTC' AND merchant.kind<>'PHARMACY'
  THEN RAISE EXCEPTION 'OTC item outside pharmacy'; END IF;
  subtotal:=subtotal+item.unit_price_pyg::bigint*qty;
  IF subtotal>50000000 THEN RAISE EXCEPTION 'Order subtotal limit exceeded'; END IF;
  INSERT INTO public.mobility_stage_merchant_order_lines
   (order_id,item_id,quantity,unit_price_pyg,line_total_pyg,unit_grams)
  VALUES(out_id,item.id,qty,item.unit_price_pyg,item.unit_price_pyg*qty,item.unit_grams);
  UPDATE public.mobility_stage_catalog_items SET stock_units=stock_units-qty,
   revision=revision+1 WHERE id=item.id;
  item_count:=item_count+1;
 END LOOP;
 IF item_count<>jsonb_array_length(_items)
 THEN RAISE EXCEPTION 'Duplicate catalog item'; END IF;
 UPDATE public.mobility_stage_merchant_orders SET subtotal_pyg=subtotal
  WHERE id=out_id;
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_merchant_order_transition(
 _order_id uuid,_actor_id uuid,_action text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE o public.mobility_stage_merchant_orders%ROWTYPE;
 old public.mobility_stage_merchant_order_events%ROWTYPE;
 target public.mobility_stage_order_status; event_id uuid; ver bigint;
 staff_allowed boolean; delivery_status public.mobility_stage_delivery_status;
BEGIN
 IF _order_id IS NULL OR _actor_id IS NULL OR _action IS NULL OR _request_key IS NULL
 OR _action NOT IN ('confirm','start_preparing','ready','cancel','hand_to_courier','complete')
 THEN RAISE EXCEPTION 'Invalid merchant order transition'; END IF;
 SELECT * INTO o FROM public.mobility_stage_merchant_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Merchant order not found'; END IF;
 SELECT * INTO old FROM public.mobility_stage_merchant_order_events WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.order_id<>_order_id OR old.actor_id<>_actor_id OR old.action<>_action
  THEN RAISE EXCEPTION 'Conflicting merchant transition replay'; END IF;
  RETURN old.id;
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.mobility_stage_merchant_staff s
  WHERE s.merchant_id=o.merchant_id AND s.user_id=_actor_id AND s.active=true)
 INTO staff_allowed;
 IF o.delivery_id IS NOT NULL THEN
  SELECT status INTO delivery_status FROM public.mobility_stage_deliveries
   WHERE id=o.delivery_id;
 END IF;
 target:=CASE
  WHEN staff_allowed AND _action='confirm' AND o.status='requested' THEN 'confirmed'
  WHEN staff_allowed AND _action='start_preparing' AND o.status='confirmed' THEN 'preparing'
  WHEN staff_allowed AND _action='ready' AND o.status='preparing' THEN 'ready'
  WHEN _action='cancel' AND o.delivery_id IS NULL AND
   ((_actor_id=o.buyer_id AND o.status IN ('requested','confirmed')) OR
    (staff_allowed AND o.status IN ('requested','confirmed','preparing'))) THEN 'cancelled'
  WHEN staff_allowed AND _action='hand_to_courier' AND o.status='ready'
   AND delivery_status='picked_up' THEN 'handed_to_courier'
  WHEN _actor_id=o.buyer_id AND _action='complete' AND o.status='handed_to_courier'
   AND delivery_status='delivered' THEN 'delivered'
  ELSE NULL END;
 IF target IS NULL THEN RAISE EXCEPTION 'Actor or order state not authorized'; END IF;
 IF target='cancelled' THEN
  UPDATE public.mobility_stage_catalog_items c SET stock_units=c.stock_units+l.quantity,
   revision=c.revision+1 FROM public.mobility_stage_merchant_order_lines l
   WHERE l.order_id=o.id AND c.id=l.item_id;
 END IF;
 UPDATE public.mobility_stage_merchant_orders SET status=target,
  revision=revision+1,changed_at=now() WHERE id=o.id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_merchant_order_events
  (request_key,order_id,actor_id,action,next_status,order_revision,delivery_id)
 VALUES(_request_key,o.id,_actor_id,_action,target,ver,o.delivery_id)
 RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_merchant_order_attach_delivery(
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
  OR d.status NOT IN ('requested','accepted')
 THEN RAISE EXCEPTION 'Delivery does not match merchant order'; END IF;
 UPDATE public.mobility_stage_merchant_orders SET delivery_id=d.id,
  revision=revision+1,changed_at=now() WHERE id=o.id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_merchant_order_events
  (request_key,order_id,actor_id,action,next_status,order_revision,delivery_id)
 VALUES(_request_key,o.id,_actor_id,'attach_delivery','ready',ver,d.id)
 RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;

REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid)
 TO service_role;
COMMIT;
