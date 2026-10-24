-- G56B A38: Driver-only paginated inbox, PostgreSQL16 DISPOSABLE QA ONLY.
-- Never apply to Supabase/staging/production. Owner synthetic mint is never an SDK RPC.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g56_send_qa(uuid,uuid,text)') IS NULL
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_g51_chat_activity') IS NULL
 THEN RAISE EXCEPTION 'G56B requires disposable G56/G51/G42'; END IF;
END $guard$;
BEGIN;

CREATE TABLE public.mobility_stage_g56_driver_inbox_revisions(
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id),
 revision bigint NOT NULL CHECK(revision>=1)
);
ALTER TABLE public.mobility_stage_g56_driver_inbox_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g56_driver_inbox_revisions
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;

CREATE TABLE public.mobility_stage_g56_driver_inbox_tickets(
 ticket_hash bytea PRIMARY KEY CHECK(octet_length(ticket_hash)=32),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms>=0),
 operation text NOT NULL DEFAULT 'DRIVER_INBOX' CHECK(operation='DRIVER_INBOX'),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'
  CHECK(evidence_kind='QA_SYNTHETIC_OWNER_ATTESTATION_ONLY')
);
CREATE INDEX mobility_stage_g56_driver_inbox_tickets_expiry
 ON public.mobility_stage_g56_driver_inbox_tickets(expires_at);
ALTER TABLE public.mobility_stage_g56_driver_inbox_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g56_driver_inbox_tickets
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;

-- Enforce monotonically increasing driver-specific inbox revision. The SQL
-- snapshot revision is locked FOR SHARE during page listing; concurrent message
-- insert / close / driver read bumps are serialized until page transaction ends.
CREATE FUNCTION public.mobility_stage_g56_bump_driver_inbox_qa()
 RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE target uuid;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' THEN
  RAISE EXCEPTION 'G56B untrusted trigger source' USING ERRCODE='G5618';
 END IF;
 IF TG_TABLE_NAME='mobility_stage_g50_chat_threads' THEN
  target:=NEW.driver_id;
 ELSIF TG_TABLE_NAME='mobility_stage_g50_chat_messages' THEN
  SELECT t.driver_id INTO target FROM public.mobility_stage_g50_chat_threads t
   WHERE t.conversation_id=NEW.conversation_id;
 ELSIF TG_TABLE_NAME='mobility_stage_g51_chat_reads' THEN
  SELECT t.driver_id INTO target FROM public.mobility_stage_g50_chat_threads t
   WHERE t.conversation_id=NEW.conversation_id;
  IF NEW.actor_id IS DISTINCT FROM target THEN RETURN NEW; END IF;
 ELSE
  RAISE EXCEPTION 'G56B untrusted trigger table' USING ERRCODE='G5618';
 END IF;
 IF target IS NULL THEN
  RAISE EXCEPTION 'G56B missing driver activity owner' USING ERRCODE='G5618';
 END IF;
 INSERT INTO public.mobility_stage_g56_driver_inbox_revisions(driver_id,revision)
 VALUES(target,1) ON CONFLICT(driver_id) DO UPDATE
 SET revision=public.mobility_stage_g56_driver_inbox_revisions.revision+1;
 RETURN NEW;
END $fn$;
CREATE TRIGGER g56b_thread_driver_inbox AFTER INSERT OR UPDATE OF state
 ON public.mobility_stage_g50_chat_threads FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g56_bump_driver_inbox_qa();
CREATE TRIGGER g56b_message_driver_inbox AFTER INSERT
 ON public.mobility_stage_g50_chat_messages FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g56_bump_driver_inbox_qa();
CREATE TRIGGER g56b_driver_read_insert AFTER INSERT
 ON public.mobility_stage_g51_chat_reads FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g56_bump_driver_inbox_qa();
CREATE TRIGGER g56b_driver_read_update AFTER UPDATE OF through_seq
 ON public.mobility_stage_g51_chat_reads FOR EACH ROW
 WHEN (NEW.through_seq IS DISTINCT FROM OLD.through_seq)
 EXECUTE FUNCTION public.mobility_stage_g56_bump_driver_inbox_qa();

INSERT INTO public.mobility_stage_g56_driver_inbox_revisions(driver_id,revision)
 SELECT t.driver_id,GREATEST(count(a.event_seq)::bigint,1)
 FROM public.mobility_stage_g50_chat_threads t
 LEFT JOIN public.mobility_stage_g51_chat_activity a
  ON a.conversation_id=t.conversation_id
 GROUP BY t.driver_id
 ON CONFLICT(driver_id) DO NOTHING;

CREATE FUNCTION public.mobility_stage_g56_inbox_mint_owner_qa(
 _driver uuid,_session uuid,_iat bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE token uuid; issued timestamptz; until timestamptz;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat)
 THEN RAISE EXCEPTION 'G56B invalid Driver session' USING ERRCODE='G5611'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1 OR
 NOT EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id=_driver AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G56B requires exclusive Driver' USING ERRCODE='G5613'; END IF;
 issued:=pg_catalog.clock_timestamp();
 until:=issued+interval '20 seconds';
 token:=pg_catalog.gen_random_uuid();
 INSERT INTO public.mobility_stage_g56_driver_inbox_tickets(
  ticket_hash,driver_id,session_id,token_iat_ms,issued_at,expires_at)
 VALUES(pg_catalog.sha256(pg_catalog.convert_to(token::text,'UTF8')),
  _driver,_session,_iat,issued,until);
 RETURN pg_catalog.jsonb_build_object(
  'ticket',token,'operation','DRIVER_INBOX',
  'expiresAtMs',floor(extract(epoch FROM until)*1000)::bigint,
  'productionEnabled',false,'qaOnly',true);
END $fn$;

-- All minting is trusted backend fixture only, without grants to delegated
-- role. Delegated role can consume exactly one inbox ticket; no direct table.
CREATE FUNCTION public.mobility_stage_g56_driver_inbox_qa(
 _ticket uuid,_expected_revision bigint DEFAULT NULL,
 _before_ms bigint DEFAULT NULL,_before_id uuid DEFAULT NULL,
 _limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g56_driver_inbox_tickets%ROWTYPE;
 rev bigint; at_ms bigint; payload jsonb; n integer;
 next_ms bigint; next_id uuid;
BEGIN
 IF _ticket IS NULL OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 100 OR
 (_before_ms IS NULL)<>(_before_id IS NULL) OR
 (_before_ms IS NOT NULL AND (_before_ms<0 OR _expected_revision IS NULL)) OR
 (_expected_revision IS NOT NULL AND _expected_revision<1)
 THEN RAISE EXCEPTION 'G56B invalid pagination' USING ERRCODE='G5612'; END IF;
 SELECT * INTO proof FROM public.mobility_stage_g56_driver_inbox_tickets
  WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_ticket::text,'UTF8'))
  FOR UPDATE;
 IF NOT FOUND
 THEN RAISE EXCEPTION 'G56B invalid ticket' USING ERRCODE='G5612'; END IF;
 IF proof.consumed_at IS NOT NULL OR proof.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G56B expired/used ticket' USING ERRCODE='G5615'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(
  proof.driver_id,proof.session_id,proof.token_iat_ms)
 THEN RAISE EXCEPTION 'G56B revoked session' USING ERRCODE='G5611'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=proof.driver_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=proof.driver_id AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G56B revoked role' USING ERRCODE='G5613'; END IF;
 -- Seed a revision for a Driver with zero conversations, then lock a stable
 -- single actor version through commit, fencing message triggers.
 INSERT INTO public.mobility_stage_g56_driver_inbox_revisions(driver_id,revision)
 VALUES(proof.driver_id,1) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM public.mobility_stage_g56_driver_inbox_revisions
  WHERE driver_id=proof.driver_id FOR SHARE;
 IF _expected_revision IS NOT NULL AND rev<>_expected_revision
 THEN RAISE EXCEPTION 'G56B inbox changed' USING ERRCODE='G5619'; END IF;
 UPDATE public.mobility_stage_g56_driver_inbox_tickets
 SET consumed_at=pg_catalog.clock_timestamp()
 WHERE ticket_hash=proof.ticket_hash;
 at_ms:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 -- A source join invokes G50 authoritative assignment FOR SHARE. Do not
 -- assume driver_id on a stale cached thread authorizes current access.
 WITH candidates AS (
  SELECT t.conversation_id,t.service_kind,t.service_id,
   floor(extract(epoch FROM a.happened_at)*1000)::bigint AS updated_ms,
   COALESCE(v.revision,1)::bigint AS thread_revision,
   COALESCE((
    SELECT count(*)::bigint FROM public.mobility_stage_g50_chat_messages m
    WHERE m.conversation_id=t.conversation_id
     AND m.sender_id=t.passenger_id
     AND m.seq>COALESCE((
      SELECT rr.through_seq FROM public.mobility_stage_g51_chat_reads rr
      WHERE rr.conversation_id=t.conversation_id AND rr.actor_id=proof.driver_id
     ),0)
   ),0) AS unread_count
  FROM public.mobility_stage_g50_chat_threads t
  JOIN LATERAL (
    SELECT happened_at,event_seq FROM public.mobility_stage_g51_chat_activity
    WHERE conversation_id=t.conversation_id
    ORDER BY event_seq DESC LIMIT 1
  ) a ON true
  JOIN LATERAL public.mobility_stage_g50_source(t.service_kind,t.service_id) src
   ON src.driver_id=t.driver_id AND src.passenger_id=t.passenger_id AND src.can_send
  LEFT JOIN public.mobility_stage_g52_thread_versions v
   ON v.conversation_id=t.conversation_id
  WHERE t.driver_id=proof.driver_id AND t.state='ACTIVE'
 ), filtered AS (
  SELECT * FROM candidates WHERE _before_ms IS NULL OR
   (updated_ms,conversation_id)<(_before_ms,_before_id)
  ORDER BY updated_ms DESC,conversation_id DESC LIMIT _limit+1
 ), visible AS(
  SELECT * FROM filtered ORDER BY updated_ms DESC,conversation_id DESC LIMIT _limit
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'conversationId',conversation_id,'serviceKind',service_kind,
  'serviceId',service_id,'counterpartRole','passenger',
  'state','ACTIVE','assignmentVerified',true,'canSend',true,
  'revision',thread_revision,'updatedAt',updated_ms,
  'unreadCount',unread_count) ORDER BY updated_ms DESC,conversation_id DESC),'[]'::jsonb),
  (SELECT count(*) FROM filtered),
  (SELECT updated_ms FROM visible ORDER BY updated_ms ASC,conversation_id ASC LIMIT 1),
  (SELECT conversation_id FROM visible ORDER BY updated_ms ASC,conversation_id ASC LIMIT 1)
 INTO payload,n,next_ms,next_id FROM visible;
 RETURN pg_catalog.jsonb_build_object(
  'ownerId',proof.driver_id,'revision',rev,'generatedAt',at_ms,
  'expiresAt',at_ms+60000,'items',payload,'hasMore',n>_limit,
  'nextPosition',CASE WHEN n>_limit THEN
   pg_catalog.jsonb_build_object('updatedAt',next_ms,'conversationId',next_id)
   ELSE NULL END,'productionEnabled',false,'qaOnly',true);
END $fn$;

REVOKE ALL ON FUNCTION
 public.mobility_stage_g56_bump_driver_inbox_qa(),
 public.mobility_stage_g56_inbox_mint_owner_qa(uuid,uuid,bigint),
 public.mobility_stage_g56_driver_inbox_qa(uuid,bigint,bigint,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g56_driver_inbox_qa(uuid,bigint,bigint,uuid,integer)
 TO mobility_g56_driver_gateway_ci;
COMMIT;
