-- G45 / A26: synthetic transaction-only buyer order reservations, PostgreSQL 16.
-- NOT a legal checkout, payment, PSP, real merchant purchase or HTTP endpoint.
-- Reuses G6 server-priced orders, with G42 lock + G44 version in ONE transaction.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g44_buyer_catalog_page(uuid,uuid,bigint,uuid,bigint,uuid,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'G45 refuses non-disposable or incomplete G44/G6 chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g45_order_receipts (
 request_key uuid PRIMARY KEY,
 receipt_id uuid NOT NULL UNIQUE DEFAULT pg_catalog.gen_random_uuid(),
 order_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_merchant_orders(id),
 buyer_id uuid NOT NULL REFERENCES auth.users(id),
 branch_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_branches(id),
 requested_vehicle_kind public.mobility_vehicle_kind NOT NULL,
 catalog_version bigint NOT NULL CHECK(catalog_version>0),
 canonical_items jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(canonical_items)='array'),
 subtotal_pyg integer NOT NULL CHECK(subtotal_pyg BETWEEN 100 AND 50000000),
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK(requested_vehicle_kind IN ('AUTO','MOTO'))
);
CREATE TABLE public.mobility_stage_g45_cancel_receipts (
 request_key uuid PRIMARY KEY,
 receipt_id uuid NOT NULL UNIQUE DEFAULT pg_catalog.gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_orders(id),
 buyer_id uuid NOT NULL REFERENCES auth.users(id),
 event_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_merchant_order_events(id),
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(order_id)
);
ALTER TABLE public.mobility_stage_g45_order_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g45_cancel_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g45_order_receipts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g45_cancel_receipts FROM PUBLIC,anon,authenticated,service_role;

-- Owner-only QA fixture! A browser or generic service_role cannot assert actor
-- identity by presenting UUID parameters. Runtime Auth/role binding is G46.
CREATE FUNCTION public.mobility_stage_g45_reserve_order_qa(
 _buyer uuid,_session uuid,_iat_ms bigint,_request_key uuid,
 _branch uuid,_catalog_version bigint,_vehicle_kind public.mobility_vehicle_kind,
 _items jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE prior public.mobility_stage_g45_order_receipts%ROWTYPE;
 version_now bigint; inserted_order uuid; total integer; response jsonb;
BEGIN
 IF _buyer IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _request_key IS NULL OR _branch IS NULL
 OR _catalog_version IS NULL OR _catalog_version<1
 OR _vehicle_kind IS NULL OR _vehicle_kind NOT IN
 ('AUTO'::public.mobility_vehicle_kind,'MOTO'::public.mobility_vehicle_kind)
 OR _items IS NULL OR pg_catalog.jsonb_typeof(_items)<>'array'
 OR pg_catalog.jsonb_array_length(_items) NOT BETWEEN 1 AND 50
 THEN RAISE EXCEPTION 'G45 invalid buyer reservation'
 USING ERRCODE='G4501'; END IF;
 -- Never trust a role, actor or AAL claim from the request. QA user/session
 -- records are provisioned by disposable database owner, not a browser.
 IF NOT public.mobility_stage_g42_lock_session(_buyer,_session,_iat_ms)
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_buyer AND role='passenger'::public.app_role)
 OR EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_buyer AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G45 buyer session denied' USING ERRCODE='G4501'; END IF;
 -- Serialize same-key requests before inspecting receipt; different buyers
 -- cannot consume stock twice on racing duplicate key.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  _request_key::text,4501));
 SELECT * INTO prior FROM public.mobility_stage_g45_order_receipts
 WHERE request_key=_request_key;
 IF FOUND THEN
  IF prior.buyer_id<>_buyer OR prior.branch_id<>_branch
   OR prior.catalog_version<>_catalog_version
   OR prior.requested_vehicle_kind<>_vehicle_kind
   OR prior.canonical_items<>_items
  THEN RAISE EXCEPTION 'G45 conflicting request key' USING ERRCODE='G4509'; END IF;
  RETURN pg_catalog.jsonb_build_object(
   'receiptId',prior.receipt_id,'orderId',prior.order_id,
   'requestKey',prior.request_key,'branchId',prior.branch_id,
   'catalogVersion',prior.catalog_version,'subtotalPyg',prior.subtotal_pyg,
   'receiptStatus','QA_RESERVED_NO_PAYMENT','orderEnabled',false,
   'productionEnabled',false);
 END IF;
 -- G6 locks branch before items. Use same order to avoid deadlocks,
 -- and ensure no stock or catalog revision changed since Buyer GET.
 PERFORM 1 FROM public.mobility_stage_merchant_branches b
 WHERE b.id=_branch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G45 branch unavailable' USING ERRCODE='G4503'; END IF;
 SELECT v.revision INTO version_now
 FROM public.mobility_stage_g44_catalog_versions v
 JOIN public.mobility_stage_g44_branch_geography g ON g.branch_id=v.branch_id
 JOIN public.mobility_stage_g31_zone_coverage z
  ON z.zone_id=g.zone_id AND z.service_kind=g.service_kind
 JOIN public.mobility_stage_merchant_branches b ON b.id=v.branch_id
 JOIN public.mobility_stage_merchants m ON m.id=b.merchant_id
 WHERE v.branch_id=_branch AND b.active AND b.accepting_orders
  AND g.service_kind=CASE WHEN _vehicle_kind='AUTO'::public.mobility_vehicle_kind
    THEN 'AUTO_DELIVERY' ELSE 'MOTO_DELIVERY' END
  AND m.status='approved' AND m.owner_id<>_buyer
  AND z.coverage_status='ACTIVE' AND z.eligible_by_policy=false
 FOR UPDATE OF v;
 IF version_now IS NULL THEN
  RAISE EXCEPTION 'G45 no eligible synthetic branch' USING ERRCODE='G4503'; END IF;
 IF version_now<>_catalog_version THEN
  RAISE EXCEPTION 'G45 stale catalog version' USING ERRCODE='G4509'; END IF;
 -- Server-side price, line count, stock lock and active order per buyer are
 -- provided by G6. No subtotal/price comes from Buyer JSON.
 inserted_order:=public.mobility_stage_merchant_order_request(
  _buyer,_request_key,_branch,_vehicle_kind,_items);
 SELECT o.subtotal_pyg INTO total FROM public.mobility_stage_merchant_orders o
 WHERE o.id=inserted_order AND o.buyer_id=_buyer;
 IF total IS NULL THEN
  RAISE EXCEPTION 'G45 missing server-priced order' USING ERRCODE='G4503'; END IF;
 INSERT INTO public.mobility_stage_g45_order_receipts(
  request_key,order_id,buyer_id,branch_id,requested_vehicle_kind,
  catalog_version,canonical_items,subtotal_pyg
 ) VALUES(_request_key,inserted_order,_buyer,_branch,_vehicle_kind,
  _catalog_version,_items,total) RETURNING * INTO prior;
 RETURN pg_catalog.jsonb_build_object(
  'receiptId',prior.receipt_id,'orderId',prior.order_id,
  'requestKey',prior.request_key,'branchId',prior.branch_id,
  'catalogVersion',prior.catalog_version,'subtotalPyg',prior.subtotal_pyg,
  'receiptStatus','QA_RESERVED_NO_PAYMENT','orderEnabled',false,
  'productionEnabled',false);
END $body$;

CREATE FUNCTION public.mobility_stage_g45_cancel_order_qa(
 _buyer uuid,_session uuid,_iat_ms bigint,_order_id uuid,_cancel_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE original public.mobility_stage_g45_order_receipts%ROWTYPE;
 old public.mobility_stage_g45_cancel_receipts%ROWTYPE;
 event_out uuid;
BEGIN
 IF _buyer IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _order_id IS NULL OR _cancel_key IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_buyer,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G45 invalid cancellation session' USING ERRCODE='G4501'; END IF;
 SELECT * INTO original FROM public.mobility_stage_g45_order_receipts
 WHERE order_id=_order_id AND buyer_id=_buyer;
 IF NOT FOUND THEN RAISE EXCEPTION 'G45 foreign order' USING ERRCODE='G4503'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  _cancel_key::text,4502));
 SELECT * INTO old FROM public.mobility_stage_g45_cancel_receipts
 WHERE request_key=_cancel_key;
 IF FOUND THEN
  IF old.order_id<>_order_id OR old.buyer_id<>_buyer
  THEN RAISE EXCEPTION 'G45 cancellation key conflict' USING ERRCODE='G4509'; END IF;
 ELSE
  -- G6 locks order row, enforces state and restores exact line quantities.
  event_out:=public.mobility_stage_merchant_order_transition(
   _order_id,_buyer,'cancel',_cancel_key);
  INSERT INTO public.mobility_stage_g45_cancel_receipts(
   request_key,order_id,buyer_id,event_id
  ) VALUES(_cancel_key,_order_id,_buyer,event_out) RETURNING * INTO old;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'orderId',old.order_id,'receiptId',old.receipt_id,
  'eventId',old.event_id,'receiptStatus','QA_CANCELLED_STOCK_RESTORED',
  'refundStatus','NO_PSP_NO_FINANCIAL_REFUND',
  'orderEnabled',false,'productionEnabled',false);
END $body$;

REVOKE ALL ON FUNCTION public.mobility_stage_g45_reserve_order_qa(
 uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g45_cancel_order_qa(
 uuid,uuid,bigint,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
