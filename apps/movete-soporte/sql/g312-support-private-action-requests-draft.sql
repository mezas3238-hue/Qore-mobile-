-- G312: Support action request outbox, PRIVATE/QUEUED ONLY.
-- Planned after audited G301 read-only bootstrap; not applied to Supabase.
-- No case mutation, message, payment, KYC, GPS, unrestricted customer data
-- or live dispatch is allowed by this migration.
-- No staff, tickets or requests are seeded.
CREATE TABLE IF NOT EXISTS public.mobility_stage_support_action_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.mobility_stage_support_cases(ticket_id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.mobility_stage_support_agents(user_id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'ACKNOWLEDGE', 'REQUEST_INFORMATION', 'ESCALATE_SAFETY',
    'ESCALATE_FINANCE', 'RESOLVE_INFORMATIONAL'
  )),
  expected_status text NOT NULL CHECK (expected_status IN (
    'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED'
  )),
  idempotency_key uuid NOT NULL,
  outcome text NOT NULL DEFAULT 'QUEUED' CHECK (outcome = 'QUEUED'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobility_g312_request_unique UNIQUE(agent_id, ticket_id, idempotency_key)
);

ALTER TABLE public.mobility_stage_support_action_requests ENABLE ROW LEVEL SECURITY;
-- Private table: reject ALL client access even if a table-wide public grant
-- appears later; no client-facing policy is created.
ALTER TABLE public.mobility_stage_support_action_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_support_action_requests
  FROM PUBLIC, anon, authenticated, service_role;
-- A separately audited trusted server may write an intent later.
-- This does NOT grant a client permission, authorize a transition,
-- or confer any API authority before an action verifier exists.
GRANT SELECT, INSERT ON public.mobility_stage_support_action_requests TO service_role;

CREATE INDEX IF NOT EXISTS mobility_g312_support_requests_ticket_order
  ON public.mobility_stage_support_action_requests(ticket_id, created_at DESC, request_id);
CREATE INDEX IF NOT EXISTS mobility_g312_support_requests_agent_order
  ON public.mobility_stage_support_action_requests(agent_id, created_at DESC, request_id);
