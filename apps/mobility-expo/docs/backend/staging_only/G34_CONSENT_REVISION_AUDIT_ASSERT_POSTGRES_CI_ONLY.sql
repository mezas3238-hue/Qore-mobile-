-- G34: immutable consent audit and revision match across G32 sessions.
-- Synthetic disposable actors and location signals; every row ROLLBACK.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G34 assertions refuse non-disposable database'; END IF;
END $guard$;
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'),
 ('d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2')
ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
INSERT INTO public.user_roles(user_id,role)
VALUES('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1','driver');
INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status)
VALUES('d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3',
 'Asuncion','AUTO_DELIVERY','PLANNED');
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
VALUES('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1',
 clock_timestamp()-interval '1 minute');
DO $initial$
BEGIN
 IF (SELECT revision FROM public.mobility_location_consents
  WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1')<>1
 OR NOT EXISTS (
  SELECT 1 FROM public.mobility_stage_g34_consent_audit a
  WHERE a.driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'
  AND a.consent_revision=1 AND a.action='OPT_IN'
 )
 THEN RAISE EXCEPTION 'G34 initial consent lacks audit revision'; END IF;
 IF has_table_privilege('authenticated',
  'public.mobility_stage_g34_consent_audit','SELECT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g34_consent_audit','INSERT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g34_consent_audit','UPDATE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g32_quarantine_signal(uuid,uuid,bigint,bigint,uuid,text,bigint,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'G34 private consent/audit privileges leaked'; END IF;
END $initial$;
SET LOCAL ROLE service_role;
DO $first$
DECLARE
 actor uuid:='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
 zone uuid:='d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3';
 ev uuid:='d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';
 refused boolean:=false;
BEGIN
 IF public.mobility_stage_g32_quarantine_signal(actor,ev,1,
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
  zone,'AUTO_DELIVERY',1,1)<>ev
 THEN RAISE EXCEPTION 'G34 current consent revision should pass'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g32_quarantine_signal(
   actor,'d5d5d5d5-d5d5-4d5d-8d5d-d5d5d5d5d5d5',2,
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
   zone,'AUTO_DELIVERY',99,1);
 EXCEPTION WHEN SQLSTATE 'G3201' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'G34 forged future consent revision accepted'; END IF;
END $first$;
RESET ROLE;

UPDATE public.mobility_location_consents
 SET revoked_at=clock_timestamp()-interval '3 seconds'
 WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
DO $revoked_revision$
BEGIN
 IF (SELECT revision FROM public.mobility_location_consents
  WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1')<>2
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g34_consent_audit
  WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'
   AND consent_revision=2 AND action='REVOKE')
 THEN RAISE EXCEPTION 'G34 revoked consent revision not audited'; END IF;
END $revoked_revision$;

UPDATE public.mobility_location_consents
 SET opted_in_at=clock_timestamp()-interval '1 second',revoked_at=NULL
 WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
DO $renewed_revision$
BEGIN
 IF (SELECT revision FROM public.mobility_location_consents
  WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1')<>3
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g34_consent_audit
  WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'
   AND consent_revision=3 AND action='RE_OPT_IN')
 OR (SELECT count(*) FROM public.mobility_stage_g34_consent_audit
  WHERE driver_id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1')<>3
 THEN RAISE EXCEPTION 'G34 re-consent must be distinctly audited'; END IF;
END $renewed_revision$;
SET LOCAL ROLE service_role;
DO $old_tokens$
DECLARE
 actor uuid:='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
 zone uuid:='d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3';
 stamp bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 refused boolean;
 success uuid;
BEGIN
 FOR rev IN 1..2 LOOP
  refused:=false;
  BEGIN
   PERFORM public.mobility_stage_g32_quarantine_signal(
    actor,'d6d6d6d6-d6d6-4d6d-8d6d-d6d6d6d6d6d6',
    2,stamp,zone,'AUTO_DELIVERY',rev,1);
  EXCEPTION WHEN SQLSTATE 'G3201' THEN refused:=true; END;
  IF NOT refused THEN RAISE EXCEPTION 'G34 stale consent revision % accepted',rev; END IF;
 END LOOP;
 success:=public.mobility_stage_g32_quarantine_signal(
  actor,'d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d7d7',
  2,stamp,zone,'AUTO_DELIVERY',3,1);
 IF success IS NULL OR
  (SELECT last_sequence FROM public.mobility_stage_g32_signal_state
    WHERE driver_id=actor)<>2
 THEN RAISE EXCEPTION 'G34 verified consent re-opt-in did not allow next signal'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g31_zone_observations
  WHERE zone_id=zone)
 THEN RAISE EXCEPTION 'G34 consent revision promoted QA GPS to availability'; END IF;
 RAISE NOTICE 'G34 PASS: revision 1 opt-in, 2 revoke, 3 re-opt-in; old revisions fail, current passes; no G31 changes';
END $old_tokens$;
RESET ROLE;
ROLLBACK;
