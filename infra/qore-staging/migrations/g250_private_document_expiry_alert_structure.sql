-- QORE G250: private STAGING STRUCTURE ONLY for future Driver document expiry monitor.
-- Code-first GitHub review before Supabase migration; never execute CI_ONLY SQL remotely.
-- No evidence attestor, send/approve/dispatch RPC, cron, or customer-facing grants.
DO $gate$
BEGIN
 IF to_regclass('public.mobility_stage_driver_documents') IS NULL
 OR to_regclass('public.mobility_vehicles') IS NULL
 OR to_regclass('public.mobility_stage_document_expiry_alert_outbox') IS NOT NULL
 OR to_regclass('public.mobility_stage_document_expiry_scan_checkpoint') IS NOT NULL
 OR (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION
  'G250 requires isolated empty QORE STAGING with G243 documents';
 END IF;
END $gate$;

CREATE TABLE public.mobility_stage_document_expiry_alert_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_key text NOT NULL UNIQUE
  CHECK (char_length(event_key) BETWEEN 40 AND 180),
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 source_document_id uuid NOT NULL
  REFERENCES public.mobility_stage_driver_documents(id) ON DELETE RESTRICT,
 document_revision bigint NOT NULL CHECK (document_revision>0),
 kind text NOT NULL CHECK(kind IN (
  'licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie')),
 valid_until timestamptz NOT NULL,
 band text NOT NULL CHECK(band IN ('D30','D15','D07','D01','EXPIRED')),
 delivery_state text NOT NULL DEFAULT 'PENDING'
  CHECK(delivery_state IN ('PENDING','SENT','SUPPRESSED')),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 delivered_at timestamptz,
 CHECK(delivered_at IS NULL OR delivery_state='SENT'),
 UNIQUE(source_document_id,document_revision,valid_until,band)
);
CREATE INDEX mobility_stage_doc_expiry_driver_idx
 ON public.mobility_stage_document_expiry_alert_outbox(driver_id,created_at DESC);
CREATE INDEX mobility_stage_doc_expiry_pending_idx
 ON public.mobility_stage_document_expiry_alert_outbox(id)
 WHERE delivery_state='PENDING';

CREATE TABLE public.mobility_stage_document_expiry_scan_checkpoint (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 resume_document_id uuid,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 last_processed_at timestamptz,
 last_completed_at timestamptz,
 -- Remains disabled until independent document evidence is deployed.
 worker_enabled boolean NOT NULL DEFAULT false CHECK(worker_enabled=false),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
INSERT INTO public.mobility_stage_document_expiry_scan_checkpoint(singleton)
 VALUES(true);

ALTER TABLE public.mobility_stage_document_expiry_alert_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_document_expiry_scan_checkpoint ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_document_expiry_alert_outbox
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_document_expiry_scan_checkpoint
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.mobility_stage_document_expiry_alert_outbox_id_seq
 FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY qore_staging_document_alert_client_denied
 ON public.mobility_stage_document_expiry_alert_outbox
 FOR SELECT TO authenticated USING(false);
CREATE POLICY qore_staging_document_checkpoint_client_denied
 ON public.mobility_stage_document_expiry_scan_checkpoint
 FOR SELECT TO authenticated USING(false);

COMMENT ON TABLE public.mobility_stage_document_expiry_alert_outbox IS
 'PRIVATE structure only; no verified attestor or push/dispatch permissions installed';
COMMENT ON TABLE public.mobility_stage_document_expiry_scan_checkpoint IS
 'PRIVATE disabled cursor structure; no cron, jobs, service_role RPC or LIVE';
