-- G157: antifraud intake from G155 independently verified participants.
-- Strictly PostgreSQL16 disposable CI. Not a remote migration, dispatch risk
-- score, suspension, payment authorization, conviction or public accusation.
DO $gate$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regclass('public.mobility_stage_g155_verified_ratings') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g27_backoffice_has_scope(uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'G157 requires disposable trusted G155 and G27 chain'; END IF;
END $gate$;
BEGIN;
CREATE TABLE public.mobility_stage_g157_fraud_signals (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 source_rating_id uuid NOT NULL UNIQUE REFERENCES
  public.mobility_stage_g155_verified_ratings(id) ON DELETE RESTRICT,
 rated_kind text NOT NULL CHECK(rated_kind IN ('DRIVER','COURIER','MERCHANT','CLIENT')),
 rated_id uuid NOT NULL,
 service_kind text NOT NULL CHECK(service_kind IN
  ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')),
 service_id uuid NOT NULL,
 reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 signal_kind text NOT NULL CHECK(signal_kind IN
  ('USER_REPORTED_SUSPECTED_FRAUD','USER_REPORTED_SAFETY')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN
  ('open','investigating','dismissed','substantiated')),
 created_at timestamptz NOT NULL,
 CHECK(reporter_id<>rated_id)
);
CREATE INDEX mobility_stage_g157_private_triage
 ON public.mobility_stage_g157_fraud_signals(status,created_at DESC,id DESC);
CREATE INDEX mobility_stage_g157_target_recent
 ON public.mobility_stage_g157_fraud_signals(rated_kind,rated_id,created_at DESC);
ALTER TABLE public.mobility_stage_g157_fraud_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g157_fraud_signals
 FROM PUBLIC,anon,authenticated,service_role;

-- A signal is an ALLEGATION, never a finding. Only the G155 row, inserted by
-- successful G42 participant + completion proof, may create a private signal.
CREATE FUNCTION public.mobility_stage_g157_capture_verified_report()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' AS $trigger$
BEGIN
 IF TG_TABLE_SCHEMA<>'public'
 OR TG_TABLE_NAME<>'mobility_stage_g155_verified_ratings'
 OR TG_OP<>'INSERT' OR NEW.id IS NULL
 OR pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G157 invalid source trigger' USING ERRCODE='P1571'; END IF;
 IF NEW.incident_code IN('SUSPECTED_FRAUD','SAFETY') THEN
  INSERT INTO public.mobility_stage_g157_fraud_signals
   (source_rating_id,rated_kind,rated_id,service_kind,service_id,
    reporter_id,signal_kind,created_at)
  VALUES(NEW.id,NEW.rated_kind,NEW.rated_id,NEW.service_kind,
   NEW.service_id,NEW.reviewer_id,
   CASE NEW.incident_code
    WHEN 'SUSPECTED_FRAUD' THEN 'USER_REPORTED_SUSPECTED_FRAUD'
    ELSE 'USER_REPORTED_SAFETY' END,NEW.created_at)
  ON CONFLICT(source_rating_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $trigger$;
REVOKE ALL ON FUNCTION public.mobility_stage_g157_capture_verified_report()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mobility_stage_g157_verified_rating_signal
 AFTER INSERT ON public.mobility_stage_g155_verified_ratings
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g157_capture_verified_report();

-- G155 already contains completed original ratings from this CI run.
-- Backfill without minting new evidence or replaying client HTTP.
INSERT INTO public.mobility_stage_g157_fraud_signals
 (source_rating_id,rated_kind,rated_id,service_kind,service_id,
  reporter_id,signal_kind,created_at)
SELECT r.id,r.rated_kind,r.rated_id,r.service_kind,r.service_id,r.reviewer_id,
 CASE r.incident_code
  WHEN 'SUSPECTED_FRAUD' THEN 'USER_REPORTED_SUSPECTED_FRAUD'
  ELSE 'USER_REPORTED_SAFETY' END,r.created_at
FROM public.mobility_stage_g155_verified_ratings r
WHERE r.incident_code IN ('SUSPECTED_FRAUD','SAFETY')
ON CONFLICT(source_rating_id) DO NOTHING;

-- Private Admin queue. At least three distinct reporters AND three
-- genuinely distinct completed services for a multi-source review indicator.
-- Counts do not label anyone as fraudulent. No raw reviewer identities,
-- free text, money, GPS or unverified evidence leave this projection.
CREATE FUNCTION public.mobility_stage_g157_admin_review_queue_qa(
 _admin uuid,_limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path='' AS $body$
DECLARE result jsonb;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _admin IS NULL OR _limit<>50 OR _limit IS NULL
 OR NOT public.mobility_stage_g27_backoffice_has_scope(
  _admin,'admin.incidents.read')
 THEN RAISE EXCEPTION 'G157 private Admin review authority required'
  USING ERRCODE='P1572'; END IF;
 WITH targets AS (
  SELECT s.rated_kind,s.rated_id,
   count(*) FILTER (WHERE s.created_at>=pg_catalog.clock_timestamp()-interval '30 days'
    AND s.status IN ('open','investigating'))::integer AS recent_reports,
   count(DISTINCT s.reporter_id) FILTER
    (WHERE s.created_at>=pg_catalog.clock_timestamp()-interval '30 days'
     AND s.status IN ('open','investigating'))::integer AS independent_reporters,
   count(DISTINCT s.service_kind||':'||s.service_id::text) FILTER
    (WHERE s.created_at>=pg_catalog.clock_timestamp()-interval '30 days'
     AND s.status IN ('open','investigating'))::integer AS distinct_services,
   max(s.created_at) AS newest_at
  FROM public.mobility_stage_g157_fraud_signals s
  GROUP BY s.rated_kind,s.rated_id
 ), observed AS (
  SELECT *,CASE WHEN recent_reports>=3 AND independent_reporters>=3
   AND distinct_services>=3 THEN 'MULTI_SOURCE_REVIEW'
   ELSE 'SINGLE_SOURCE_REVIEW' END AS review_tier
  FROM targets WHERE recent_reports>0
 ), ordered AS (
  SELECT * FROM observed
  ORDER BY (review_tier='MULTI_SOURCE_REVIEW') DESC,
    newest_at DESC,rated_kind,rated_id LIMIT 51
 )
 SELECT pg_catalog.jsonb_build_object(
  'qaOnly',true,'productionEnabled',false,'automaticSuspension',false,
  'dispatchPenaltyApplied',false,'findingEstablished',false,
  'hasMore',(SELECT count(*)>50 FROM ordered),
  'items',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'ratedKind',rated_kind,'ratedId',rated_id,
   'recentReports',recent_reports,'independentReporters',independent_reporters,
   'distinctServices',distinct_services,'reviewTier',review_tier,
   'allegationOnly',true)
   ORDER BY (review_tier='MULTI_SOURCE_REVIEW') DESC,newest_at DESC)
   FROM (SELECT * FROM ordered LIMIT 50) page),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g157_admin_review_queue_qa(uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g157_admin_review_queue_qa(uuid,integer)
 TO service_role;

-- No service/API role has INSERT, UPDATE, DELETE, SELECT of raw signals,
-- nor EXECUTE of capture. G8 remains the independent, explicit suspension
-- authority following genuine Admin review; NO trigger or function calls G8.
COMMIT;
