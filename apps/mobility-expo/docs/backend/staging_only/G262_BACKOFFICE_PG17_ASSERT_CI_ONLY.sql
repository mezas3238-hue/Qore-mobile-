-- G262 CI ONLY: after candidate DDL, insert disposable identities and
-- verify every backoffice privilege in a throw-away PG17 container.
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444'),
 ('55555555-5555-4555-8555-555555555555'),
 ('66666666-6666-4666-8666-666666666666'),
 ('77777777-7777-4777-8777-777777777777');
INSERT INTO public.mobility_stage_backoffice_roles
 (user_id,role,status,approved_by)
 VALUES
 ('11111111-1111-4111-8111-111111111111','admin','active',
  '33333333-3333-4333-8333-333333333333'),
 ('22222222-2222-4222-8222-222222222222','owner','active',
  '33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444','admin','active',
  '33333333-3333-4333-8333-333333333333'),
 ('55555555-5555-4555-8555-555555555555','admin','pending',
  '33333333-3333-4333-8333-333333333333'),
 ('66666666-6666-4666-8666-666666666666','owner','suspended',
  '33333333-3333-4333-8333-333333333333'),
 ('77777777-7777-4777-8777-777777777777','admin','active',
  '77777777-7777-4777-8777-777777777777');
INSERT INTO public.user_roles(user_id,role)
 VALUES('44444444-4444-4444-8444-444444444444','driver');

DO $gate$
DECLARE oid_role oid; oid_scope oid;
BEGIN
 SELECT to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)')
  INTO oid_role;
 SELECT to_regprocedure('public.mobility_stage_g27_backoffice_has_scope(uuid,text)')
  INTO oid_scope;
 IF oid_role IS NULL OR oid_scope IS NULL
 OR EXISTS(SELECT 1 FROM pg_proc WHERE oid IN (oid_role,oid_scope)
    AND (prosecdef OR provolatile<>'s'))
 OR has_function_privilege('anon',oid_role,'EXECUTE')
 OR has_function_privilege('authenticated',oid_role,'EXECUTE')
 OR has_function_privilege('anon',oid_scope,'EXECUTE')
 OR has_function_privilege('authenticated',oid_scope,'EXECUTE')
 OR NOT has_function_privilege('service_role',oid_role,'EXECUTE')
 OR NOT has_function_privilege('service_role',oid_scope,'EXECUTE')
 THEN RAISE EXCEPTION 'G262 function permissions / invoker security failure'; END IF;
END $gate$;

BEGIN;
SET LOCAL ROLE service_role;
DO $assert$
DECLARE a uuid:='11111111-1111-4111-8111-111111111111';
 o uuid:='22222222-2222-4222-8222-222222222222';
 d uuid:='44444444-4444-4444-8444-444444444444';
 p uuid:='55555555-5555-4555-8555-555555555555';
 s uuid:='66666666-6666-4666-8666-666666666666';
 x uuid:='77777777-7777-4777-8777-777777777777';
 z uuid:='00000000-0000-4000-8000-000000000001';
BEGIN
 IF public.mobility_stage_g27_backoffice_role_of(a) IS DISTINCT FROM 'admin'
 OR public.mobility_stage_g27_backoffice_role_of(o) IS DISTINCT FROM 'owner'
 OR public.mobility_stage_g27_backoffice_role_of(d) IS NOT NULL
 OR public.mobility_stage_g27_backoffice_role_of(p) IS NOT NULL
 OR public.mobility_stage_g27_backoffice_role_of(s) IS NOT NULL
 OR public.mobility_stage_g27_backoffice_role_of(x) IS NOT NULL
 OR public.mobility_stage_g27_backoffice_role_of(z) IS NOT NULL
 THEN RAISE EXCEPTION 'G262 exclusive backoffice role rejection failed'; END IF;
 IF NOT public.mobility_stage_g27_backoffice_has_scope(a,'admin.audit.read')
 OR NOT public.mobility_stage_g27_backoffice_has_scope(a,'admin.incidents.read')
 OR NOT public.mobility_stage_g27_backoffice_has_scope(o,'owner.finance.read')
 OR public.mobility_stage_g27_backoffice_has_scope(a,'owner.finance.read')
 OR public.mobility_stage_g27_backoffice_has_scope(o,'admin.kyc.read')
 OR public.mobility_stage_g27_backoffice_has_scope(o,'admin.incidents.read')
 OR public.mobility_stage_g27_backoffice_has_scope(d,'admin.audit.read')
 OR public.mobility_stage_g27_backoffice_has_scope(p,'admin.audit.read')
 OR public.mobility_stage_g27_backoffice_has_scope(s,'owner.finance.read')
 OR public.mobility_stage_g27_backoffice_has_scope(x,'admin.audit.read')
 OR public.mobility_stage_g27_backoffice_has_scope(z,'admin.audit.read')
 OR public.mobility_stage_g27_backoffice_has_scope(a,'owner.unknown')
 OR public.mobility_stage_g27_backoffice_has_scope(a,NULL)
 THEN RAISE EXCEPTION 'G262 scope separation / negative access failure'; END IF;
END $assert$;
COMMIT;
SELECT 'G262_POSTGRES17_INVOCER_READONLY_ADMIN_OWNER_SCOPE_PASS' AS result;
