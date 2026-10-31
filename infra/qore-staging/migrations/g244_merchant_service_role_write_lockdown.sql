-- G244: preserve the later G46 commerce fail-closed privilege fence in real STAGING.
-- G240 installs structural DDL only; G6/G9 CI had provisional generic DML
-- grants that G46 later REVOKES. Mirror the stronger G46 invariant here.
-- No account creation, commercial orders, transaction API or fixtures.
DO $staging$
BEGIN
 IF to_regclass('public.mobility_stage_merchants') IS NULL OR
    to_regclass('public.mobility_stage_merchant_management_events') IS NULL
 THEN RAISE EXCEPTION 'G244 requires G240 isolated merchant schema'; END IF;
END $staging$;
REVOKE ALL ON
 public.mobility_stage_merchants,
 public.mobility_stage_merchant_staff,
 public.mobility_stage_merchant_branches,
 public.mobility_stage_catalog_items,
 public.mobility_stage_merchant_orders,
 public.mobility_stage_merchant_order_lines,
 public.mobility_stage_merchant_order_events,
 public.mobility_stage_merchant_management_events
 FROM service_role;
GRANT SELECT ON
 public.mobility_stage_merchants,
 public.mobility_stage_merchant_staff,
 public.mobility_stage_merchant_branches,
 public.mobility_stage_catalog_items,
 public.mobility_stage_merchant_orders,
 public.mobility_stage_merchant_order_lines,
 public.mobility_stage_merchant_order_events,
 public.mobility_stage_merchant_management_events
 TO service_role;
-- Own membership SELECT for authenticated merchants stays G240's RLS only.
-- Future mutations require verified G42 JWT-bound private RPCs, not G6/G9 shortcuts.
