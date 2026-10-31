-- QORE STAGING Merchant Privilege Boundary / 2026-10-31.
-- ONLY isolated project mrjzxftsdxzepzbcuids. Not LIVE.
-- Private, tightly-authorized SECURITY DEFINER function bodies + public
-- SECURITY INVOKER service_role-only wrappers. No broad service_role write
-- access to Merchant tables. No anon/authenticated RPC, no PSP and no seed.
-- Original G6/G9 CI_ONLY file must NEVER be applied remotely.
BEGIN;
DO $guard$
DECLARE tbl text;
BEGIN
 IF to_regnamespace('qore_stage_internal') IS NOT NULL
 OR EXISTS(
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
   AND p.proname IN ('mobility_stage_merchant_onboarding_request','mobility_stage_merchant_review','mobility_stage_merchant_branch_upsert','mobility_stage_catalog_item_upsert','mobility_stage_merchant_order_request','mobility_stage_merchant_order_transition','mobility_stage_merchant_order_attach_delivery')
 )
 THEN RAISE EXCEPTION 'QORE merchant STAGING private schema/RPC already exists'; END IF;
 FOREACH tbl IN ARRAY ARRAY['mobility_stage_merchants','mobility_stage_merchant_staff','mobility_stage_merchant_branches','mobility_stage_catalog_items','mobility_stage_merchant_orders','mobility_stage_merchant_order_lines','mobility_stage_merchant_order_events','mobility_stage_merchant_management_events','mobility_stage_deliveries'] LOOP
  IF to_regclass('public.'||tbl) IS NULL
  THEN RAISE EXCEPTION 'QORE merchant prerequisite missing: %',tbl; END IF;
 END LOOP;
 IF EXISTS(
  SELECT 1 FROM pg_tables t WHERE t.schemaname='public'
  AND t.tablename LIKE 'mobility_stage_merchant%'
  AND (has_table_privilege('service_role',format('public.%I',t.tablename),'INSERT')
    OR has_table_privilege('service_role',format('public.%I',t.tablename),'UPDATE'))
 ) OR has_table_privilege('service_role','public.mobility_stage_catalog_items','INSERT')
 OR has_table_privilege('service_role','public.mobility_stage_catalog_items','UPDATE')
 THEN RAISE EXCEPTION 'Merchant direct write lockdown was altered; abort'; END IF;
END
$guard$;

CREATE SCHEMA qore_stage_internal;
REVOKE ALL ON SCHEMA qore_stage_internal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA qore_stage_internal TO service_role;

CREATE FUNCTION qore_stage_internal.mobility_stage_merchant_onboarding_request(
 _owner_id uuid,_request_key uuid,_kind public.mobility_stage_merchant_kind,
 _display_tag text
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE old public.mobility_stage_merchants%ROWTYPE; out_id uuid;
 payload jsonb;
BEGIN
 IF _owner_id IS NULL OR _request_key IS NULL OR _kind IS NULL
 OR _display_tag IS NULL OR _display_tag !~ '^[A-Z_]{3,40}$'
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_owner_id AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'Invalid merchant onboarding request'; END IF;
 SELECT * INTO old FROM public.mobility_stage_merchants WHERE onboarding_key=_request_key;
 IF FOUND THEN
  IF old.owner_id<>_owner_id OR old.kind<>_kind OR old.display_tag<>_display_tag
  THEN RAISE EXCEPTION 'Conflicting merchant onboarding replay'; END IF;
  RETURN old.id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_merchants WHERE owner_id=_owner_id)
 THEN RAISE EXCEPTION 'Merchant owner already registered'; END IF;
 INSERT INTO public.mobility_stage_merchants(onboarding_key,owner_id,kind,display_tag)
 VALUES(_request_key,_owner_id,_kind,_display_tag) RETURNING id INTO out_id;
 INSERT INTO public.mobility_stage_merchant_staff(merchant_id,user_id,staff_role)
 VALUES(out_id,_owner_id,'owner');
 payload:=pg_catalog.jsonb_build_object('kind',_kind::text,'displayTag',_display_tag);
 INSERT INTO public.mobility_stage_merchant_management_events
  (request_key,merchant_id,actor_id,action,entity_kind,entity_id,parameters)
 VALUES(_request_key,out_id,_owner_id,'request','MERCHANT',out_id,payload);
 RETURN out_id;
END
$body$;

CREATE FUNCTION qore_stage_internal.mobility_stage_merchant_review(
 _merchant_id uuid,_admin_id uuid,_action text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE merchant public.mobility_stage_merchants%ROWTYPE;
 old public.mobility_stage_merchant_management_events%ROWTYPE;
 event_id uuid; payload jsonb;
BEGIN
 IF _merchant_id IS NULL OR _admin_id IS NULL OR _request_key IS NULL
 OR _action NOT IN ('approve','suspend')
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_admin_id AND role='admin'::public.app_role)
 THEN RAISE EXCEPTION 'Verified admin merchant review required'; END IF;
 payload:=pg_catalog.jsonb_build_object('action',_action);
 SELECT * INTO old FROM public.mobility_stage_merchant_management_events
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.merchant_id<>_merchant_id OR old.actor_id<>_admin_id
   OR old.action<>_action OR old.parameters<>payload
  THEN RAISE EXCEPTION 'Conflicting merchant review replay'; END IF;
  RETURN old.id;
 END IF;
 SELECT * INTO merchant FROM public.mobility_stage_merchants
  WHERE id=_merchant_id FOR UPDATE;
 IF NOT FOUND OR (_action='approve' AND merchant.status<>'pending')
  OR (_action='suspend' AND merchant.status<>'approved')
 THEN RAISE EXCEPTION 'Merchant review state unavailable'; END IF;
 UPDATE public.mobility_stage_merchants
 SET status=CASE WHEN _action='approve'
   THEN 'approved'::public.mobility_stage_merchant_status
   ELSE 'suspended'::public.mobility_stage_merchant_status END,
  reviewed_by=_admin_id,reviewed_at=now() WHERE id=_merchant_id;
 IF _action='suspend' THEN
  UPDATE public.mobility_stage_merchant_branches
   SET accepting_orders=false WHERE merchant_id=_merchant_id;
 END IF;
 INSERT INTO public.mobility_stage_merchant_management_events
  (request_key,merchant_id,actor_id,action,entity_kind,entity_id,parameters)
 VALUES(_request_key,_merchant_id,_admin_id,_action,'MERCHANT',_merchant_id,payload)
 RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;

CREATE FUNCTION qore_stage_internal.mobility_stage_merchant_branch_upsert(
 _merchant_id uuid,_actor_id uuid,_request_key uuid,_branch_tag text,
 _pickup_tag text,_preparation_minutes integer,_active boolean,
 _accepting_orders boolean
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE merchant public.mobility_stage_merchants%ROWTYPE;
 branch public.mobility_stage_merchant_branches%ROWTYPE;
 old public.mobility_stage_merchant_management_events%ROWTYPE;
 out_id uuid; action_name text; payload jsonb;
BEGIN
 IF _merchant_id IS NULL OR _actor_id IS NULL OR _request_key IS NULL
 OR _branch_tag IS NULL OR _branch_tag !~ '^[A-Z_]{3,40}$'
 OR _pickup_tag IS NULL OR _pickup_tag !~ '^[A-Z_]{3,40}$'
 OR _preparation_minutes NOT BETWEEN 1 AND 180
 OR _active IS NULL OR _accepting_orders IS NULL
 THEN RAISE EXCEPTION 'Invalid merchant branch'; END IF;
 payload:=pg_catalog.jsonb_build_object('branchTag',_branch_tag,
  'pickupTag',_pickup_tag,'preparationMinutes',_preparation_minutes,
  'active',_active,'acceptingOrders',_accepting_orders);
 SELECT * INTO old FROM public.mobility_stage_merchant_management_events
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.merchant_id<>_merchant_id OR old.actor_id<>_actor_id
   OR old.entity_kind<>'BRANCH' OR old.parameters<>payload
  THEN RAISE EXCEPTION 'Conflicting branch replay'; END IF;
  RETURN old.entity_id;
 END IF;
 SELECT * INTO merchant FROM public.mobility_stage_merchants
  WHERE id=_merchant_id FOR UPDATE;
 IF NOT FOUND OR merchant.status<>'approved' OR NOT EXISTS(SELECT 1
  FROM public.mobility_stage_merchant_staff WHERE merchant_id=_merchant_id
   AND user_id=_actor_id AND active=true AND staff_role IN ('owner','manager'))
 THEN RAISE EXCEPTION 'Merchant branch actor unavailable'; END IF;
 SELECT * INTO branch FROM public.mobility_stage_merchant_branches
  WHERE merchant_id=_merchant_id AND branch_tag=_branch_tag FOR UPDATE;
 IF FOUND THEN
  UPDATE public.mobility_stage_merchant_branches SET pickup_tag=_pickup_tag,
   preparation_minutes=_preparation_minutes,active=_active,
   accepting_orders=(_active AND _accepting_orders) WHERE id=branch.id;
  out_id:=branch.id;action_name:='branch_update';
 ELSE
  INSERT INTO public.mobility_stage_merchant_branches
   (merchant_id,branch_tag,pickup_tag,preparation_minutes,active,accepting_orders)
  VALUES(_merchant_id,_branch_tag,_pickup_tag,_preparation_minutes,_active,
   _active AND _accepting_orders) RETURNING id INTO out_id;
  action_name:='branch_create';
 END IF;
 INSERT INTO public.mobility_stage_merchant_management_events
  (request_key,merchant_id,actor_id,action,entity_kind,entity_id,parameters)
 VALUES(_request_key,_merchant_id,_actor_id,action_name,'BRANCH',out_id,payload);
 RETURN out_id;
END
$body$;

CREATE FUNCTION qore_stage_internal.mobility_stage_catalog_item_upsert(
 _branch_id uuid,_actor_id uuid,_request_key uuid,_sku text,_item_tag text,
 _item_class public.mobility_stage_catalog_class,_unit_price_pyg integer,
 _unit_grams integer,_stock_units integer,_active boolean
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE branch public.mobility_stage_merchant_branches%ROWTYPE;
 merchant public.mobility_stage_merchants%ROWTYPE;
 item public.mobility_stage_catalog_items%ROWTYPE;
 old public.mobility_stage_merchant_management_events%ROWTYPE;
 out_id uuid; action_name text; payload jsonb;
BEGIN
 IF _branch_id IS NULL OR _actor_id IS NULL OR _request_key IS NULL
 OR _sku IS NULL OR _sku !~ '^[A-Z0-9_-]{2,40}$'
 OR _item_tag IS NULL OR _item_tag !~ '^[A-Z0-9_]{2,50}$'
 OR _item_class IS NULL OR _unit_price_pyg NOT BETWEEN 100 AND 10000000
 OR _unit_grams NOT BETWEEN 1 AND 50000 OR _stock_units NOT BETWEEN 0 AND 1000000
 OR _active IS NULL THEN RAISE EXCEPTION 'Invalid catalog item'; END IF;
 payload:=pg_catalog.jsonb_build_object('branchId',_branch_id,'sku',_sku,
  'itemTag',_item_tag,'itemClass',_item_class::text,'unitPricePyg',_unit_price_pyg,
  'unitGrams',_unit_grams,'stockUnits',_stock_units,'active',_active);
 SELECT * INTO old FROM public.mobility_stage_merchant_management_events
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.actor_id<>_actor_id OR old.entity_kind<>'ITEM' OR old.parameters<>payload
  THEN RAISE EXCEPTION 'Conflicting catalog replay'; END IF;
  RETURN old.entity_id;
 END IF;
 SELECT * INTO branch FROM public.mobility_stage_merchant_branches
  WHERE id=_branch_id FOR UPDATE;
 SELECT * INTO merchant FROM public.mobility_stage_merchants
  WHERE id=branch.merchant_id FOR UPDATE;
 IF branch.id IS NULL OR merchant.id IS NULL OR merchant.status<>'approved'
  OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_merchant_staff
   WHERE merchant_id=merchant.id AND user_id=_actor_id AND active=true
    AND staff_role IN ('owner','manager'))
  OR (_item_class='PHARMACY_OTC' AND merchant.kind<>'PHARMACY')
 THEN RAISE EXCEPTION 'Catalog actor or class unavailable'; END IF;
 SELECT * INTO item FROM public.mobility_stage_catalog_items
  WHERE branch_id=_branch_id AND sku=_sku FOR UPDATE;
 IF FOUND THEN
  UPDATE public.mobility_stage_catalog_items SET item_tag=_item_tag,
   item_class=_item_class,unit_price_pyg=_unit_price_pyg,unit_grams=_unit_grams,
   stock_units=_stock_units,active=_active,revision=revision+1 WHERE id=item.id;
  out_id:=item.id;action_name:='item_update';
 ELSE
  INSERT INTO public.mobility_stage_catalog_items
   (branch_id,sku,item_tag,item_class,unit_price_pyg,unit_grams,stock_units,active)
  VALUES(_branch_id,_sku,_item_tag,_item_class,_unit_price_pyg,_unit_grams,
   _stock_units,_active) RETURNING id INTO out_id;
  action_name:='item_create';
 END IF;
 INSERT INTO public.mobility_stage_merchant_management_events
  (request_key,merchant_id,actor_id,action,entity_kind,entity_id,parameters)
 VALUES(_request_key,merchant.id,_actor_id,action_name,'ITEM',out_id,payload);
 RETURN out_id;
END
$body$;

CREATE FUNCTION qore_stage_internal.mobility_stage_merchant_order_request(
 _buyer_id uuid,_request_key uuid,_branch_id uuid,
 _vehicle_kind public.mobility_vehicle_kind,_items jsonb
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
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
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_buyer_id
     AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'Verified passenger buyer required'; END IF;
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

CREATE FUNCTION qore_stage_internal.mobility_stage_merchant_order_transition(
 _order_id uuid,_actor_id uuid,_action text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
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
  JOIN public.mobility_stage_merchants m ON m.id=s.merchant_id
  WHERE s.merchant_id=o.merchant_id AND s.user_id=_actor_id AND s.active=true
   AND m.status='approved')
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

CREATE FUNCTION qore_stage_internal.mobility_stage_merchant_order_attach_delivery(
 _order_id uuid,_actor_id uuid,_delivery_id uuid,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
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
  JOIN public.mobility_stage_merchants m ON m.id=s.merchant_id
  WHERE s.merchant_id=o.merchant_id AND s.user_id=_actor_id AND s.active=true
   AND m.status='approved')
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

CREATE FUNCTION public.mobility_stage_merchant_onboarding_request(_owner_id uuid,_request_key uuid,_kind public.mobility_stage_merchant_kind, _display_tag text)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $qore_wrapper$
 SELECT qore_stage_internal.mobility_stage_merchant_onboarding_request(_owner_id,_request_key,_kind,_display_tag);
$qore_wrapper$;

CREATE FUNCTION public.mobility_stage_merchant_review(_merchant_id uuid,_admin_id uuid,_action text,_request_key uuid)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $qore_wrapper$
 SELECT qore_stage_internal.mobility_stage_merchant_review(_merchant_id,_admin_id,_action,_request_key);
$qore_wrapper$;

CREATE FUNCTION public.mobility_stage_merchant_branch_upsert(_merchant_id uuid,_actor_id uuid,_request_key uuid,_branch_tag text, _pickup_tag text,_preparation_minutes integer,_active boolean, _accepting_orders boolean)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $qore_wrapper$
 SELECT qore_stage_internal.mobility_stage_merchant_branch_upsert(_merchant_id,_actor_id,_request_key,_branch_tag,_pickup_tag,_preparation_minutes,_active,_accepting_orders);
$qore_wrapper$;

CREATE FUNCTION public.mobility_stage_catalog_item_upsert(_branch_id uuid,_actor_id uuid,_request_key uuid,_sku text,_item_tag text, _item_class public.mobility_stage_catalog_class,_unit_price_pyg integer, _unit_grams integer,_stock_units integer,_active boolean)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $qore_wrapper$
 SELECT qore_stage_internal.mobility_stage_catalog_item_upsert(_branch_id,_actor_id,_request_key,_sku,_item_tag,_item_class,_unit_price_pyg,_unit_grams,_stock_units,_active);
$qore_wrapper$;

CREATE FUNCTION public.mobility_stage_merchant_order_request(_buyer_id uuid,_request_key uuid,_branch_id uuid, _vehicle_kind public.mobility_vehicle_kind,_items jsonb)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $qore_wrapper$
 SELECT qore_stage_internal.mobility_stage_merchant_order_request(_buyer_id,_request_key,_branch_id,_vehicle_kind,_items);
$qore_wrapper$;

CREATE FUNCTION public.mobility_stage_merchant_order_transition(_order_id uuid,_actor_id uuid,_action text,_request_key uuid)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $qore_wrapper$
 SELECT qore_stage_internal.mobility_stage_merchant_order_transition(_order_id,_actor_id,_action,_request_key);
$qore_wrapper$;

CREATE FUNCTION public.mobility_stage_merchant_order_attach_delivery(_order_id uuid,_actor_id uuid,_delivery_id uuid,_request_key uuid)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $qore_wrapper$
 SELECT qore_stage_internal.mobility_stage_merchant_order_attach_delivery(_order_id,_actor_id,_delivery_id,_request_key);
$qore_wrapper$;

REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text) TO service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_merchant_review(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_merchant_review(uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_review(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_review(uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_merchant_branch_upsert(uuid,uuid,uuid,text,text,integer,boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_merchant_branch_upsert(uuid,uuid,uuid,text,text,integer,boolean,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_branch_upsert(uuid,uuid,uuid,text,text,integer,boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_branch_upsert(uuid,uuid,uuid,text,text,integer,boolean,boolean) TO service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean) TO service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb) TO service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid) TO service_role;

-- The original merchant table DENY policies and ALL role GRANTs are unchanged.
-- Production/commerce flags remain OFF.
COMMIT;
