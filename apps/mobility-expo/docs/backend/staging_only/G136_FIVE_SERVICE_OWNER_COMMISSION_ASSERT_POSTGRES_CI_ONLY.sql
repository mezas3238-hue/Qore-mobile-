-- G136: five Owner commission controls, isolated PostgreSQL16 only.
-- This uses the exact G116 role/RPC/SQL guard. No payment nor merchant settlement.
BEGIN;
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id) VALUES
 ('13600000-0000-4136-8136-000000000001'),
 ('13600000-0000-4136-8136-000000000002');
DELETE FROM public.user_roles WHERE user_id='13600000-0000-4136-8136-000000000001';
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES('13600000-0000-4136-8136-000000000001','owner','active',
 '13600000-0000-4136-8136-000000000001');
DO $test$
DECLARE
 owner_id uuid:='13600000-0000-4136-8136-000000000001';
 outsider uuid:='13600000-0000-4136-8136-000000000002';
 k text;
 got jsonb;
 changed jsonb;
 replay jsonb;
 expected integer;
 denied boolean;
BEGIN
 FOREACH k IN ARRAY ARRAY['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO',
  'DELIVERY_MOTO','COMMERCE'] LOOP
  got:=public.mobility_stage_g116_read_commission_qa(k);
  IF got IS NULL OR got->>'serviceKind'<>k OR (got->>'version')::integer<>1
  OR (got->>'subsidyBps')::integer <>
     (CASE WHEN k IN ('AUTO_RIDE','MOTO_RIDE') THEN 1000 ELSE 0 END)
  THEN RAISE EXCEPTION 'G136 initial five-policy read failed for %',k; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'] LOOP
  expected:=CASE k WHEN 'DELIVERY_AUTO' THEN 800
   WHEN 'DELIVERY_MOTO' THEN 750 ELSE 1200 END;
  changed:=public.mobility_stage_g116_set_commission_qa(
   owner_id,k,expected,pg_catalog.gen_random_uuid());
  IF changed->>'serviceKind'<>k OR changed->>'subsidyBps'<>'0'
   OR (changed->>'commissionBps')::integer<>expected
   OR changed->>'version'<>'2'
  THEN RAISE EXCEPTION 'G136 persisted % bad',k; END IF;
  IF public.mobility_stage_g116_read_commission_qa(k)<>changed
  THEN RAISE EXCEPTION 'G136 read-after-write drift %',k; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.mobility_stage_g116_commission_audit audit
     WHERE audit.owner_id='13600000-0000-4136-8136-000000000001'::uuid)<>3
 THEN RAISE EXCEPTION 'G136 audit missing'; END IF;
 got:=public.mobility_stage_g116_read_commission_qa('AUTO_RIDE');
 IF got->>'commissionBps'<>'1500' OR got->>'subsidyBps'<>'1000'
 THEN RAISE EXCEPTION 'G136 changed passenger fare unexpectedly'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g116_set_commission_qa(
   outsider,'DELIVERY_MOTO',900,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P1161' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G136 foreign owner permitted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g116_set_commission_qa(
   owner_id,'AUTO_RIDE',900,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P1161' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G136 passenger 10pct subsidy broken'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g116_set_commission_qa(
   owner_id,'MERCHANT_ORDER',1200,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P1161' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G136 unknown vertical permitted'; END IF;
 RAISE NOTICE 'G136 PASS: five separate persisted Owner commissions, unchanged passenger subsidy, audit, deny unauthorized';
END $test$;
ROLLBACK;
