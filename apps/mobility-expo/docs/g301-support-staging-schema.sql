-- G301: Support STAGING access isolation. Noncommercial; zero seeded staff/tickets.
-- Apply only to authorized PG17 STAGING. Never grants Owner/Admin/Driver privileges.
-- Support staff must be approved by an already active independently approved Owner.
CREATE TABLE IF NOT EXISTS public.mobility_stage_support_agents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active','suspended','revoked')),
  approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobility_g301_distinct_approver CHECK (user_id <> approved_by)
);
ALTER TABLE public.mobility_stage_support_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_support_agents FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.mobility_stage_support_cases (
  ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code text NOT NULL UNIQUE CHECK (case_code ~ '^[A-Z0-9-]{5,32}$'),
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_support_id uuid REFERENCES public.mobility_stage_support_agents(user_id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('VIAJE_AUTO','VIAJE_MOTO','ENVIO_AUTO','ENVIO_MOTO','COMERCIO','CUENTA','OTRO')),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 5 AND 240 AND summary !~ '[[:cntrl:]]'),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','ESCALATED','RESOLVED')),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL','HIGH','CRITICAL')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mobility_stage_support_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_support_cases FROM PUBLIC, anon, authenticated;
-- No requester ID, free-form private records, document URLs, banking data or raw GPS exposed.
GRANT SELECT (
  ticket_id,case_code,category,summary,status,priority,
  assigned_support_id,updated_at
) ON public.mobility_stage_support_cases TO authenticated;

-- SECURITY DEFINER exposes strictly a self-only yes/no role disclosure.
-- It does not return other staff identities or any case data.
CREATE OR REPLACE FUNCTION public.mobility_stage_support_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $g301$
  SELECT CASE WHEN (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (SELECT auth.jwt()->>'role') = 'authenticated'
    AND (SELECT auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id=(SELECT auth.uid()) AND u.is_anonymous IS NOT TRUE
        AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
    )
    AND EXISTS (
      SELECT 1 FROM auth.sessions se
      JOIN auth.mfa_factors f ON f.id=se.factor_id
      WHERE se.id::text=(SELECT auth.jwt()->>'session_id')
        AND se.user_id=(SELECT auth.uid())
        AND se.aal::text='aal2'
        AND (se.not_after IS NULL OR se.not_after>now())
        AND f.user_id=se.user_id
        AND f.factor_type::text='totp' AND f.status::text='verified'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id=(SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.mobility_stage_backoffice_roles br
      WHERE br.user_id=(SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.mobility_stage_support_agents sa
      JOIN public.mobility_stage_backoffice_roles approver
        ON approver.user_id=sa.approved_by
      WHERE sa.user_id=(SELECT auth.uid())
        AND sa.status='active' AND sa.approved_by<>sa.user_id
        AND approver.role='owner' AND approver.status='active'
        AND approver.approved_by<>approver.user_id
    )
  THEN 'support'::text ELSE NULL::text END
$g301$;
REVOKE ALL ON FUNCTION public.mobility_stage_support_my_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_support_my_role() TO authenticated;

DROP POLICY IF EXISTS mobility_g301_support_minimal_read ON public.mobility_stage_support_cases;
CREATE POLICY mobility_g301_support_minimal_read
ON public.mobility_stage_support_cases
FOR SELECT TO authenticated
USING (
  (SELECT public.mobility_stage_support_my_role())='support'
  AND (assigned_support_id=(SELECT auth.uid()) OR assigned_support_id IS NULL)
);
-- SELECT only, read only. No INSERT/UPDATE/DELETE permissions, no public bucket.
-- No staff or cases created in this migration. LIVE_TRIPS/PSP remain OFF.
CREATE INDEX IF NOT EXISTS mobility_g301_support_cases_queue
ON public.mobility_stage_support_cases (updated_at DESC, ticket_id)
WHERE assigned_support_id IS NULL;
CREATE INDEX IF NOT EXISTS mobility_g301_support_cases_assignee
ON public.mobility_stage_support_cases (assigned_support_id,updated_at DESC);
