-- G27 A04.2 adversarial trusted-authority checks, disposable DB only.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
  current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G27 authority test refuses non-disposable DB'; END IF;
 IF to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 THEN RAISE EXCEPTION 'G27 authority table missing'; END IF;
END $guard$;
BEGIN;
-- Synthetic actors, not identity records or real MFA enrollments.
INSERT INTO auth.users(id)
VALUES
 ('18181818-1818-4818-8818-181818181818'::uuid),
 ('19191919-1919-4919-8919-191919191919'::uuid),
 ('1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'::uuid)
ON CONFLICT (id) DO NOTHING;
-- G1 signup defaults to Passenger: privileged QA provisioning must remove
-- that base role before a BACKOFFICE principal can become active.
DELETE FROM public.user_roles WHERE user_id IN
 ('18181818-1818-4818-8818-181818181818'::uuid,
  '19191919-1919-4919-8919-191919191919'::uuid,
  '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'::uuid);

INSERT INTO public.mobility_stage_backoffice_roles
 (user_id,role,status,approved_by)
VALUES
 ('18181818-1818-4818-8818-181818181818'::uuid,
  'admin','active','1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'::uuid),
 ('19191919-1919-4919-8919-191919191919'::uuid,
  'owner','active','1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'::uuid);
-- RLS and GRANTS: only service_role may read, and no ordinary role may
-- self-assign/update even a synthetic backoffice role.
DO $priv$
BEGIN
 IF has_table_privilege('authenticated','public.mobility_stage_backoffice_roles','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_backoffice_roles','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_backoffice_roles','UPDATE')
 OR has_table_privilege('anon','public.mobility_stage_backoffice_roles','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_backoffice_roles','INSERT')
 OR has_table_privilege('service_role','public.mobility_stage_backoffice_roles','UPDATE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g27_backoffice_role_of(uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g27_backoffice_has_scope(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'G27 backoffice browser privilege leakage'; END IF;
END $priv$;

SET LOCAL ROLE service_role;
DO $roles$
DECLARE
 admin_id uuid:='18181818-1818-4818-8818-181818181818';
 owner_id uuid:='19191919-1919-4919-8919-191919191919';
BEGIN
 IF public.mobility_stage_g27_backoffice_role_of(admin_id)<>'admin'
 OR public.mobility_stage_g27_backoffice_role_of(owner_id)<>'owner'
 OR NOT public.mobility_stage_g27_backoffice_has_scope(admin_id,'admin.kyc.read')
 OR NOT public.mobility_stage_g27_backoffice_has_scope(admin_id,'admin.zones.read')
 OR NOT public.mobility_stage_g27_backoffice_has_scope(admin_id,'admin.incidents.read')
 OR NOT public.mobility_stage_g27_backoffice_has_scope(admin_id,'admin.audit.read')
 OR NOT public.mobility_stage_g27_backoffice_has_scope(owner_id,'owner.finance.read')
 OR public.mobility_stage_g27_backoffice_has_scope(admin_id,'owner.finance.read')
 OR public.mobility_stage_g27_backoffice_has_scope(owner_id,'admin.kyc.read')
 OR public.mobility_stage_g27_backoffice_has_scope(owner_id,'admin.audit.read')
 OR public.mobility_stage_g27_backoffice_has_scope(owner_id,'owner.finance.write')
 OR public.mobility_stage_g27_backoffice_has_scope(admin_id,'admin.permissions.write')
 THEN RAISE EXCEPTION 'G27 scope separation was bypassed'; END IF;
END $roles$;
RESET ROLE;

-- Reintroducing ANY native passenger/driver/admin role must revoke the
-- effective backoffice authority even when registry row remains active.
INSERT INTO public.user_roles(user_id,role)
VALUES ('19191919-1919-4919-8919-191919191919'::uuid,'passenger');
SET LOCAL ROLE service_role;
DO $mixed$
BEGIN
 IF public.mobility_stage_g27_backoffice_role_of(
  '19191919-1919-4919-8919-191919191919') IS NOT NULL
 OR public.mobility_stage_g27_backoffice_has_scope(
  '19191919-1919-4919-8919-191919191919','owner.finance.read')
 THEN RAISE EXCEPTION 'G27 dual native/backoffice role accepted'; END IF;
END $mixed$;
RESET ROLE;

UPDATE public.mobility_stage_backoffice_roles SET status='suspended',revision=revision+1
 WHERE user_id='18181818-1818-4818-8818-181818181818';
SET LOCAL ROLE service_role;
DO $revoked$
BEGIN
 IF public.mobility_stage_g27_backoffice_role_of(
  '18181818-1818-4818-8818-181818181818') IS NOT NULL
 OR public.mobility_stage_g27_backoffice_has_scope(
  '18181818-1818-4818-8818-181818181818','admin.kyc.read')
 THEN RAISE EXCEPTION 'G27 suspended Admin still authorized'; END IF;
 RAISE NOTICE 'G27 backend-only Admin/Owner scopes, RLS, dual-role and suspension: PASS';
END $revoked$;
RESET ROLE;
ROLLBACK; -- Synthetic identities/role grants never leave disposable assertions.
