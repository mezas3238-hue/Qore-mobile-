-- G326 · QORE Mobile · Owner/Admin readiness (only read).
-- Executed and verified on Supabase STAGING PostgreSQL 17.11, 2026-11-12.
-- Operational run: Supabase SQL Editor using an authorized administrator.
-- NEVER paste secrets or user IDs. Does not activate roles, MFA, payments, KYC, or deployment.
-- A verified factor is NOT proof that a particular browser/session is currently AAL2.
WITH counts AS (
 SELECT
  (SELECT count(*) FROM auth.users)::int AS auth_accounts,
  (SELECT count(*) FROM auth.mfa_factors WHERE status='verified')::int AS verified_factors,
  (SELECT count(*) FROM public.mobility_stage_backoffice_roles
    WHERE role='owner' AND status='active')::int AS active_owners,
  (SELECT count(*) FROM public.mobility_stage_backoffice_roles
    WHERE role='admin' AND status='active')::int AS active_admins,
  (SELECT count(*) FROM public.mobility_stage_backoffice_roles br
    WHERE br.role='owner' AND br.status='active' AND br.user_id<>br.approved_by
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=br.user_id)
   )::int AS eligible_owners,
  (SELECT count(DISTINCT br.user_id) FROM public.mobility_stage_backoffice_roles br
    JOIN auth.mfa_factors f ON f.user_id=br.user_id AND f.status='verified'
    WHERE br.role='owner' AND br.status='active' AND br.user_id<>br.approved_by
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=br.user_id)
   )::int AS owner_factors_verified,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'mobility_stage_support%'
   )::int AS support_tables
), permissions AS (
 SELECT count(*)::int AS function_count,
  COALESCE(bool_and(NOT p.prosecdef
   AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
   AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')),false) AS server_only
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('mobility_stage_g27_backoffice_role_of','mobility_stage_g27_backoffice_has_scope')
)
SELECT metric,value,gate
FROM counts c CROSS JOIN permissions p
CROSS JOIN LATERAL (VALUES
 ('Auth QA accounts',c.auth_accounts::text,
   CASE WHEN c.auth_accounts>0 THEN 'PRESENT' ELSE 'BLOCKED' END),
 ('MFA factors verified (all roles)',c.verified_factors::text,
   CASE WHEN c.verified_factors>0 THEN 'PRESENT' ELSE 'BLOCKED' END),
 ('Owner rows active',c.active_owners::text,
   CASE WHEN c.active_owners>0 THEN 'PRESENT' ELSE 'BLOCKED' END),
 ('Owner eligibility (not self-approved, not native role)',c.eligible_owners::text,
   CASE WHEN c.eligible_owners>0 THEN 'PRESENT' ELSE 'BLOCKED' END),
 ('Owner verified factor presence',c.owner_factors_verified::text,
   CASE WHEN c.owner_factors_verified>0 THEN 'PRESENT' ELSE 'BLOCKED' END),
 ('Admin rows active',c.active_admins::text,
   CASE WHEN c.active_admins>0 THEN 'PRESENT' ELSE 'BLOCKED' END),
 ('G27 RPC server-only privilege check',p.function_count::text,
   CASE WHEN p.function_count=2 AND p.server_only THEN 'PASS' ELSE 'BLOCKED' END),
 ('Support tables installed',c.support_tables::text,
   CASE WHEN c.support_tables>0 THEN 'PRESENT' ELSE 'BLOCKED' END),
 ('Owner current AAL2 session','not measurable by SQL','REQUIRES_EXTERNAL_IDP_LOGIN')
) AS v(metric,value,gate)
ORDER BY metric;
