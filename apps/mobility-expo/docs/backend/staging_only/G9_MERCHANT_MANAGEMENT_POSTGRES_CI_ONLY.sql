-- QORE G9: merchant onboarding, approval, branches and catalog management.
-- POSTGRESQL 16 DISPOSABLE CI ONLY. NEVER deploy remotely or approve a business.
-- Requires the G6 merchant/order schema and G8 admin/suspension controls.
BEGIN;

CREATE UNIQUE INDEX mobility_stage_one_merchant_per_owner
 ON public.mobility_stage_merchants(owner_id);
CREATE TABLE public.mobility_stage_merchant_management_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN
  ('request','approve','suspend','branch_create','branch_update','item_create','item_update')),
 entity_kind text NOT NULL CHECK(entity_kind IN ('MERCHANT','BRANCH','ITEM')),
 entity_id uuid NOT NULL,
 parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mobility_stage_merchant_management_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchant_management_events
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mobility_stage_merchant_management_events TO service_role;

CREATE FUNCTION public.mobility_stage_merchant_onboarding_request(
 _owner_id uuid,_request_key uuid,_kind public.mobility_stage_merchant_kind,
 _display_tag text
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
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

CREATE FUNCTION public.mobility_stage_merchant_review(
 _merchant_id uuid,_admin_id uuid,_action text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
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
 SET status=CASE WHEN _action='approve' THEN 'approved' ELSE 'suspended' END,
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

CREATE FUNCTION public.mobility_stage_merchant_branch_upsert(
 _merchant_id uuid,_actor_id uuid,_request_key uuid,_branch_tag text,
 _pickup_tag text,_preparation_minutes integer,_active boolean,
 _accepting_orders boolean
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
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

CREATE FUNCTION public.mobility_stage_catalog_item_upsert(
 _branch_id uuid,_actor_id uuid,_request_key uuid,_sku text,_item_tag text,
 _item_class public.mobility_stage_catalog_class,_unit_price_pyg integer,
 _unit_grams integer,_stock_units integer,_active boolean
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
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

REVOKE ALL ON FUNCTION public.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_review(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_merchant_branch_upsert(uuid,uuid,uuid,text,text,integer,boolean,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_review(uuid,uuid,text,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_merchant_branch_upsert(uuid,uuid,uuid,text,text,integer,boolean,boolean)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean)
 TO service_role;
COMMIT;
