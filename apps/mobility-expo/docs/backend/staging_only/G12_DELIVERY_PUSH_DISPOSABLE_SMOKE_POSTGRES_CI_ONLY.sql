-- G12 isolated disposable PostgreSQL 16 smoke; NO REMOTE DATABASE.
-- Minimal fixture preserves the exact columns and state predicates of G10.
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE public.mobility_stage_delivery_offers(
 id uuid PRIMARY KEY,delivery_id uuid NOT NULL,courier_id uuid NOT NULL,
 status text NOT NULL,expires_at timestamptz NOT NULL
);
CREATE TABLE public.mobility_stage_deliveries(
 id uuid PRIMARY KEY,status text NOT NULL
);
CREATE TABLE public.mobility_stage_delivery_offer_outbox(
 offer_id uuid PRIMARY KEY,courier_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 accepted_for_processing_at timestamptz,receipt_confirmed_at timestamptz
);
INSERT INTO public.mobility_stage_deliveries VALUES
 ('00000000-0000-4000-8000-000000000011','requested');
INSERT INTO public.mobility_stage_delivery_offers VALUES
 ('00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000013',
  'offered',now()+interval '60 seconds');
INSERT INTO public.mobility_stage_delivery_offer_outbox(offer_id,courier_id)
 VALUES('00000000-0000-4000-8000-000000000012',
        '00000000-0000-4000-8000-000000000013');
COMMIT;
