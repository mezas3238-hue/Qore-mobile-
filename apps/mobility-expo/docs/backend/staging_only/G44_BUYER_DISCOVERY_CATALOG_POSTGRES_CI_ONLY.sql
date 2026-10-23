-- G44 / A25: buyer discovery + catalog keysets; PostgreSQL disposable CI ONLY.
-- Synthetic geography is NOT legal coverage, offer dispatch, checkout or LIVE.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_catalog_items') IS NULL
 OR to_regclass('public.mobility_stage_g31_zone_coverage') IS NULL
 THEN RAISE EXCEPTION 'G44 refuses non-disposable/incomplete schema'; END IF;
END $guard$;
BEGIN;
-- The mapping is private, owner-seeded QA metadata. Never invent municipality
-- from a branch tag or pretend G31 coverage ACTIVE implies legal eligibility.
CREATE TABLE public.mobility_stage_g44_branch_geography (
 branch_id uuid PRIMARY KEY REFERENCES public.mobility_stage_merchant_branches(id),
 zone_id uuid NOT NULL,
 service_kind text NOT NULL CHECK(service_kind IN('AUTO_DELIVERY','MOTO_DELIVERY')),
 source_kind text NOT NULL DEFAULT 'QA_SYNTHETIC_MAPPING_ONLY'
  CHECK(source_kind='QA_SYNTHETIC_MAPPING_ONLY'),
 FOREIGN KEY(zone_id,service_kind)
  REFERENCES public.mobility_stage_g31_zone_coverage(zone_id,service_kind)
);
ALTER TABLE public.mobility_stage_g44_branch_geography ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g44_branch_geography
 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.mobility_stage_g44_catalog_versions (
 branch_id uuid PRIMARY KEY REFERENCES public.mobility_stage_merchant_branches(id),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0)
);
ALTER TABLE public.mobility_stage_g44_catalog_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g44_catalog_versions
 FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO public.mobility_stage_g44_catalog_versions(branch_id)
 SELECT b.id FROM public.mobility_stage_merchant_branches b
 ON CONFLICT DO NOTHING;

-- Any stock/price/tag change, branch suspension, merchant review or mapped
-- zone edit invalidates previously signed page cursors.
CREATE FUNCTION public.mobility_stage_g44_bump_catalog_version()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE target uuid;
BEGIN
 IF TG_TABLE_NAME='mobility_stage_catalog_items'
 OR TG_TABLE_NAME='mobility_stage_merchant_branches' THEN
  target:=CASE WHEN TG_OP='DELETE' THEN OLD.branch_id ELSE NEW.branch_id END;
  -- branch id column differs from item.branch_id.
  IF TG_TABLE_NAME='mobility_stage_merchant_branches' THEN
   target:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  END IF;
  INSERT INTO public.mobility_stage_g44_catalog_versions(branch_id,revision)
    VALUES(target,1)
   ON CONFLICT(branch_id) DO UPDATE SET revision=
    public.mobility_stage_g44_catalog_versions.revision+1;
 ELSIF TG_TABLE_NAME='mobility_stage_merchants' THEN
  UPDATE public.mobility_stage_g44_catalog_versions v SET revision=revision+1
   FROM public.mobility_stage_merchant_branches b
   WHERE b.id=v.branch_id AND b.merchant_id=NEW.id;
 ELSIF TG_TABLE_NAME='mobility_stage_g44_branch_geography' THEN
  target:=CASE WHEN TG_OP='DELETE' THEN OLD.branch_id ELSE NEW.branch_id END;
  UPDATE public.mobility_stage_g44_catalog_versions SET revision=revision+1
   WHERE branch_id=target;
 ELSIF TG_TABLE_NAME='mobility_stage_g31_zone_coverage' THEN
  UPDATE public.mobility_stage_g44_catalog_versions v SET revision=revision+1
   FROM public.mobility_stage_g44_branch_geography g
   WHERE v.branch_id=g.branch_id AND g.zone_id=NEW.zone_id
    AND g.service_kind=NEW.service_kind;
 END IF;
 RETURN NULL;
END $body$;
-- Avoid row transition assumptions: all triggers are AFTER.
CREATE TRIGGER g44_item_revision AFTER INSERT OR UPDATE OR DELETE
 ON public.mobility_stage_catalog_items FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g44_bump_catalog_version();
CREATE TRIGGER g44_branch_revision AFTER INSERT OR UPDATE
 ON public.mobility_stage_merchant_branches FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g44_bump_catalog_version();
CREATE TRIGGER g44_merchant_revision AFTER UPDATE OF status
 ON public.mobility_stage_merchants FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g44_bump_catalog_version();
CREATE TRIGGER g44_geography_revision AFTER INSERT OR UPDATE OR DELETE
 ON public.mobility_stage_g44_branch_geography FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g44_bump_catalog_version();
CREATE TRIGGER g44_zone_revision AFTER UPDATE OF coverage_status,eligible_by_policy
 ON public.mobility_stage_g31_zone_coverage FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g44_bump_catalog_version();

CREATE FUNCTION public.mobility_stage_g44_buyer_branches_page(
 _buyer uuid,_session uuid,_iat_ms bigint,_municipality text,
 _service_kind text,_after uuid,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE result jsonb;
BEGIN
 IF _buyer IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _municipality IS NULL OR char_length(_municipality) NOT BETWEEN 2 AND 80
 OR _municipality<>pg_catalog.btrim(_municipality)
 OR _service_kind NOT IN('AUTO_DELIVERY','MOTO_DELIVERY')
 OR _limit IS DISTINCT FROM 100
 OR NOT public.mobility_stage_g42_lock_session(_buyer,_session,_iat_ms)
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_buyer AND role='passenger'::public.app_role)
 OR EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_buyer AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G44 buyer/session/zone refused' USING ERRCODE='G4401'; END IF;

 WITH eligible AS (
  SELECT b.id AS branch_id,b.branch_tag,m.kind,g.service_kind,
   c.municipality
  FROM public.mobility_stage_g44_branch_geography g
  JOIN public.mobility_stage_g31_zone_coverage c
   ON c.zone_id=g.zone_id AND c.service_kind=g.service_kind
  JOIN public.mobility_stage_merchant_branches b ON b.id=g.branch_id
  JOIN public.mobility_stage_merchants m ON m.id=b.merchant_id
  WHERE c.municipality=_municipality AND g.service_kind=_service_kind
    AND c.coverage_status='ACTIVE'
    AND c.eligible_by_policy=false -- staging ONLY, never dispatch
    AND b.active AND b.accepting_orders AND m.status='approved'
    AND m.owner_id<>_buyer
 ), limited AS (
  SELECT * FROM eligible WHERE _after IS NULL OR branch_id>_after
  ORDER BY branch_id LIMIT 101
 ), visible AS (SELECT * FROM limited ORDER BY branch_id LIMIT 100)
 SELECT pg_catalog.jsonb_build_object(
  'hasMore',(SELECT count(*)>100 FROM limited),
  'items',COALESCE((SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('branchId',branch_id,
     'branchTag',branch_tag,'merchantKind',kind::text,
     'municipality',municipality,'serviceKind',service_kind,
     'eligibleByPolicy',false,'orderEnabled',false)
    ORDER BY branch_id) FROM visible),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $body$;

CREATE FUNCTION public.mobility_stage_g44_buyer_catalog_page(
 _buyer uuid,_session uuid,_iat_ms bigint,_branch uuid,
 _expected_revision bigint,_after uuid,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE revision_now bigint; result jsonb;
BEGIN
 IF _buyer IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _branch IS NULL OR _limit IS DISTINCT FROM 100
 OR (_expected_revision IS NOT NULL AND _expected_revision<1)
 OR NOT public.mobility_stage_g42_lock_session(_buyer,_session,_iat_ms)
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_buyer AND role='passenger'::public.app_role)
 OR EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_buyer AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G44 buyer/session refused' USING ERRCODE='G4401'; END IF;
 -- HOLD the version lock for the whole caller transaction, so stock edits
 -- cannot change a page while it is constructed. A later request rechecks.
 SELECT v.revision INTO revision_now
 FROM public.mobility_stage_g44_catalog_versions v
 JOIN public.mobility_stage_merchant_branches b ON b.id=v.branch_id
 JOIN public.mobility_stage_merchants m ON m.id=b.merchant_id
 JOIN public.mobility_stage_g44_branch_geography g ON g.branch_id=b.id
 JOIN public.mobility_stage_g31_zone_coverage c
  ON c.zone_id=g.zone_id AND c.service_kind=g.service_kind
 WHERE v.branch_id=_branch AND m.status='approved' AND
  m.owner_id<>_buyer AND b.active AND b.accepting_orders
  AND c.coverage_status='ACTIVE' AND c.eligible_by_policy=false
 FOR SHARE OF v;
 IF revision_now IS NULL THEN
  RAISE EXCEPTION 'G44 branch not eligible for QA read' USING ERRCODE='G4403';
 END IF;
 IF _expected_revision IS NOT NULL AND _expected_revision<>revision_now THEN
  RAISE EXCEPTION 'G44 catalog changed, refresh first page'
    USING ERRCODE='G4409'; END IF;

 WITH limited AS (
  SELECT i.id,i.item_tag,i.item_class,i.unit_price_pyg,i.stock_units
  FROM public.mobility_stage_catalog_items i
  WHERE i.branch_id=_branch AND i.active AND i.stock_units>0
  AND (_after IS NULL OR i.id>_after)
  AND (i.item_class='GENERAL' OR i.item_class='PHARMACY_OTC'
   AND EXISTS(SELECT 1 FROM public.mobility_stage_merchant_branches b
    JOIN public.mobility_stage_merchants m ON m.id=b.merchant_id
    WHERE b.id=i.branch_id AND m.kind='PHARMACY'))
  ORDER BY i.id LIMIT 101
 ), visible AS (SELECT * FROM limited ORDER BY id LIMIT 100)
 SELECT pg_catalog.jsonb_build_object(
  'branchId',_branch,'version',revision_now,
  'expiresAt',floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint+60000,
  'hasMore',(SELECT count(*)>100 FROM limited),
  'items',COALESCE((SELECT pg_catalog.jsonb_agg(
   pg_catalog.jsonb_build_object(
    'itemId',id,'itemTag',item_tag,'itemClass',item_class::text,
    'active',true,'unitPricePyg',unit_price_pyg,'stockUnits',stock_units)
   ORDER BY id) FROM visible),'[]'::jsonb),
  'orderEnabled',false,'eligibleByPolicy',false
 ) INTO result;
 RETURN result;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g44_bump_catalog_version()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g44_buyer_branches_page(
 uuid,uuid,bigint,text,text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g44_buyer_catalog_page(
 uuid,uuid,bigint,uuid,bigint,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
-- Execution is private server-to-DB only; G42 session guard is mandatory.
GRANT EXECUTE ON FUNCTION public.mobility_stage_g44_buyer_branches_page(
 uuid,uuid,bigint,text,text,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g44_buyer_catalog_page(
 uuid,uuid,bigint,uuid,bigint,uuid,integer) TO service_role;
COMMIT;
