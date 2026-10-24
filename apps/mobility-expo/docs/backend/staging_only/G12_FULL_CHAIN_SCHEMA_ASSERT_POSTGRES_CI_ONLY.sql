-- Run only against G0 synthetic Auth + REAL G1/G2/G3/G4/G5/G10/G12 schema.
-- Local PostgreSQL 16 disposable CI, never a production migration.
DO $assert$
DECLARE n integer;
BEGIN
 IF current_database()<>'qore_disposable_chain' THEN
  RAISE EXCEPTION 'Wrong CI database'; END IF;
 IF to_regclass('public.mobility_stage_delivery_offer_outbox') IS NULL
 OR to_regclass('public.mobility_stage_delivery_offers') IS NULL
 OR to_regclass('public.mobility_stage_deliveries') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_offers') IS NULL
 THEN RAISE EXCEPTION 'Missing real G4/G5/G10 schema'; END IF;
 IF (SELECT NOT relrowsecurity FROM pg_catalog.pg_class
     WHERE oid='public.mobility_stage_delivery_offer_outbox'::regclass)
 THEN RAISE EXCEPTION 'G10 outbox RLS disabled'; END IF;
 IF has_table_privilege('authenticated','public.mobility_stage_delivery_offer_outbox','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_delivery_offer_outbox','UPDATE')
 OR has_table_privilege('anon','public.mobility_stage_delivery_offer_outbox','SELECT')
 THEN RAISE EXCEPTION 'Client gained private delivery outbox access'; END IF;
 IF NOT has_table_privilege('service_role','public.mobility_stage_delivery_offer_outbox','SELECT')
 OR NOT has_table_privilege('service_role','public.mobility_stage_delivery_offer_outbox','UPDATE')
 THEN RAISE EXCEPTION 'Service lacks G10 outbox permissions'; END IF;
 IF has_function_privilege('authenticated',
   'public.mobility_stage_claim_delivery_push(uuid)','EXECUTE')
 OR has_function_privilege('anon',
   'public.mobility_stage_ack_delivery_push(uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Client gained service RPC access'; END IF;
 IF NOT has_function_privilege('service_role',
   'public.mobility_stage_claim_delivery_push(uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
   'public.mobility_stage_expire_delivery_push_claims()','EXECUTE')
 THEN RAISE EXCEPTION 'Service lacks G12 RPC access'; END IF;
END $assert$;

-- Execute G12 invoker SQL under the actual synthetic service role, rather
-- than merely checking grants while connected as PostgreSQL superuser.
SET ROLE service_role;
DO $assert$
DECLARE n integer;
DECLARE worker uuid := '00000000-0000-4000-8000-000000000021';
BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_claim_delivery_push(worker);
 IF n<>0 THEN RAISE EXCEPTION 'Unexpected private offer in empty full-chain DB'; END IF;
 SELECT public.mobility_stage_expire_delivery_push_claims() INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'Unexpected cleanup in empty full-chain DB'; END IF;
 IF public.mobility_stage_ack_delivery_push(worker,worker,'ticket_12345')
 THEN RAISE EXCEPTION 'ACK succeeded for nonexisting real-schema offer'; END IF;
END $assert$;
RESET ROLE;
