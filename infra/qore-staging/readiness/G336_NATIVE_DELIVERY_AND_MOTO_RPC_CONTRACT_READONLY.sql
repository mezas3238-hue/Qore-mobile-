-- G336 QORE MOBILE: CURRENT PG17 CONTRACT INVENTORY, READ ONLY
-- Intended for authorized operator inspection ONLY; no DDL, DML, role grants,
-- authorization bypass, KYC approvals, provider requests or test data.
-- Matches G331/G336 server-only adapters and detects function overloads by
-- exact signature. Catalog presence is NOT a permission or E2E certificate.
-- Legacy mobility_stage_delivery_accept is RETIRED, intentionally NOT expected:
-- G10 mobility_stage_delivery_accept_offer handles private G42-verified offers.
WITH expected(area,kind,namespace,name,arg_types,meaning) AS (
 VALUES
 ('AUTO','rpc','public','mobility_stage_g73_route','uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer','CURRENT'),
 ('AUTO','rpc','public','mobility_stage_g73_quote','uuid,uuid,uuid','CURRENT'),
 ('AUTO','rpc','public','mobility_stage_g73_book','uuid,uuid,uuid','CURRENT'),
 ('AUTO_PINS','table','qore_stage_internal','mobility_stage_g329_auto_pinned_routes','','DRAFT_NOT_INSTALLED'),
 ('AUTO_PINS','rpc','public','mobility_stage_g329_route_pinned_receipt','uuid,uuid','DRAFT_NOT_INSTALLED'),
 ('MOTO','rpc','public','mobility_stage_g100_moto_quote_qa','uuid,uuid,text,text,text,integer,integer','MISSING_PG17_NATIVE'),
 ('MOTO','rpc','public','mobility_stage_g100_moto_book_qa','uuid,uuid,uuid','MISSING_PG17_NATIVE'),
 ('MOTO','rpc','public','mobility_stage_g100_moto_booking_receipt_qa','uuid,uuid','MISSING_PG17_NATIVE'),
 ('MOTO','rpc','public','mobility_stage_g118_moto_status_qa','uuid,uuid','MISSING_PG17_NATIVE'),
 ('MOTO','rpc','public','mobility_stage_g100_moto_cancel_qa','uuid,uuid,uuid','MISSING_PG17_NATIVE'),
 ('DELIVERY','table','public','mobility_stage_deliveries','','CURRENT'),
 ('DELIVERY','rpc','public','mobility_stage_delivery_request','uuid,uuid,public.mobility_vehicle_kind,public.mobility_stage_delivery_category,integer,integer,integer,integer,text,text,boolean','CURRENT'),
 ('DELIVERY','rpc','public','mobility_stage_delivery_transition','uuid,uuid,text,uuid,uuid','CURRENT'),
 ('DELIVERY_G10','rpc','public','mobility_stage_delivery_offer','uuid,uuid,uuid,uuid,integer','CURRENT_PRIVATE_OFFER'),
 ('DELIVERY_G10','rpc','public','mobility_stage_delivery_accept_offer','uuid,uuid,uuid','CURRENT_PRIVATE_OFFER'),
 ('DELIVERY_G10','rpc','public','mobility_stage_delivery_decline_offer','uuid,uuid,uuid','CURRENT_PRIVATE_OFFER'),
 ('DELIVERY_PRICE','rpc','public','mobility_stage_g122_accept_delivery_quote_qa','uuid,uuid,uuid,uuid,integer,text','MISSING_PG17_NATIVE'),
 ('COMMERCE','table','public','mobility_stage_merchant_orders','','CURRENT'),
 ('COMMERCE','rpc','public','mobility_stage_merchant_order_request','uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb','CHECK_SIGNATURE'),
 ('ADMIN','rpc','public','mobility_stage_g262_admin_native_trace_qa','uuid,text,uuid','CURRENT'),
 ('ADMIN','rpc','public','mobility_stage_g75_admin_f1_receipt','uuid,uuid','DRAFT_NOT_INSTALLED')
), observed AS (
 SELECT area,kind,namespace,name,meaning,
 CASE WHEN kind='table'
  THEN pg_catalog.to_regclass(pg_catalog.format('%I.%I',namespace,name)) IS NOT NULL
  ELSE pg_catalog.to_regprocedure(pg_catalog.format('%I.%I(%s)',namespace,name,arg_types)) IS NOT NULL
 END AS exact_present
 FROM expected
)
SELECT area,kind,namespace || '.' || name AS object_name,exact_present,meaning,
 false AS external_e2e_certified
FROM observed ORDER BY area,object_name;
