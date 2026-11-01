-- G280 disposable assertions: NO Supabase/Auth/production writes.
DO $access$
BEGIN
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_read_driver_document_status(uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_driver_current_license_approved(uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_read_driver_document_status(uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_driver_current_license_approved(uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'qore_stage_internal.mobility_stage_read_driver_document_status(uuid)','EXECUTE')
 OR has_table_privilege('service_role','public.mobility_stage_driver_documents','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_driver_documents','SELECT')
 THEN RAISE EXCEPTION 'G280 private function grants or direct document ACL unsafe'; END IF;
END $access$;

-- Driver has no documents => empty status; no current license => FALSE.
SET ROLE service_role;
DO $unprovisioned$
DECLARE
 driver uuid:='00000000-0000-4000-8000-000000000101';
 passenger uuid:='00000000-0000-4000-8000-000000000102';
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_read_driver_document_status(driver))<>0
 OR (SELECT count(*) FROM public.mobility_stage_read_driver_document_status(passenger))<>0
 OR public.mobility_stage_driver_current_license_approved(driver) IS DISTINCT FROM false
 OR public.mobility_stage_driver_current_license_approved(passenger) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G280 unprovisioned/Passenger KYC is incorrectly approved'; END IF;
END $unprovisioned$;
RESET ROLE;

-- An uploaded, even approved-looking document must not imply a legal approval.
INSERT INTO public.mobility_stage_driver_documents
 (id,driver_id,kind,status,submitted_at,reviewed_at,reviewer_id)
 VALUES
 ('00000000-0000-4000-8000-000000000201',
 '00000000-0000-4000-8000-000000000101',
 'licencia','pending',now()-interval '2 days',NULL,NULL),
 ('00000000-0000-4000-8000-000000000202',
 '00000000-0000-4000-8000-000000000101',
 'licencia','approved',now()-interval '1 day',
 now()-interval '10 minutes','00000000-0000-4000-8000-000000000104'),
 ('00000000-0000-4000-8000-000000000203',
 '00000000-0000-4000-8000-000000000103',
 'licencia','rejected',now()-interval '2 hours',
 now()-interval '1 hour','00000000-0000-4000-8000-000000000104');
SET ROLE service_role;
DO $scope$
DECLARE driver uuid:='00000000-0000-4000-8000-000000000101';
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_read_driver_document_status(driver))<>1
 OR (SELECT status FROM public.mobility_stage_read_driver_document_status(driver)
    WHERE kind='licencia')<>'approved'
 OR (SELECT count(*) FROM public.mobility_stage_read_driver_document_status(
    '00000000-0000-4000-8000-000000000103'))<>1
 OR public.mobility_stage_driver_current_license_approved(driver) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G280 document scoping/latest status or no-compliance fail-closed'; END IF;
END $scope$;
RESET ROLE;

INSERT INTO public.mobility_driver_compliance
 (driver_id,license_valid_through,license_verified_at,license_verified_by,driver_review_status)
 VALUES ('00000000-0000-4000-8000-000000000101',
 CURRENT_DATE+30,now()-interval '1 minute',
 '00000000-0000-4000-8000-000000000104','approved');
INSERT INTO public.mobility_stage_driver_document_reviews
 (document_id,reviewer_id,status,reviewed_at)
 VALUES ('00000000-0000-4000-8000-000000000202',
 '00000000-0000-4000-8000-000000000104',
 'approved',
 now()-interval '10 minutes');

SET ROLE service_role;
DO $unapproved$
BEGIN
 IF public.mobility_stage_driver_current_license_approved(
  '00000000-0000-4000-8000-000000000101') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G280 KYC approved without independent G27'; END IF;
END $unapproved$;
RESET ROLE;

-- Synthetic, separately approved Backoffice reviewer exists ONLY in PG CI.
INSERT INTO public.mobility_stage_backoffice_roles
 (user_id,role,status,approved_by)
 VALUES ('00000000-0000-4000-8000-000000000104',
 'admin','active','00000000-0000-4000-8000-000000000105');
SET ROLE service_role;
DO $approved$
BEGIN
 IF public.mobility_stage_driver_current_license_approved(
 '00000000-0000-4000-8000-000000000101') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G280 complete synthetic approved license not recognized'; END IF;
 IF public.mobility_stage_driver_current_license_approved(
 '00000000-0000-4000-8000-000000000103') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G280 second Driver inherited approval'; END IF;
END $approved$;
RESET ROLE;

-- A later rejection on the SAME document revokes an older approval,
-- even if an application forgot to update a cached document status.
INSERT INTO public.mobility_stage_driver_document_reviews
 (document_id,reviewer_id,status,reviewed_at)
 VALUES ('00000000-0000-4000-8000-000000000202',
 '00000000-0000-4000-8000-000000000104',
 'rejected',now()-interval '1 second');
SET ROLE service_role;
DO $later_rejected$
BEGIN
 IF public.mobility_stage_driver_current_license_approved(
 '00000000-0000-4000-8000-000000000101') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G280 later rejection did not cancel earlier license approval'; END IF;
END $later_rejected$;
RESET ROLE;
DELETE FROM public.mobility_stage_driver_document_reviews
 WHERE document_id='00000000-0000-4000-8000-000000000202'
   AND status='rejected';

UPDATE public.mobility_stage_backoffice_roles
 SET status='suspended' WHERE user_id='00000000-0000-4000-8000-000000000104';
SET ROLE service_role;
DO $revoked$
BEGIN
 IF public.mobility_stage_driver_current_license_approved(
 '00000000-0000-4000-8000-000000000101') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G280 revoked Backoffice reviewer still grants license'; END IF;
END $revoked$;
RESET ROLE;
UPDATE public.mobility_stage_backoffice_roles SET status='active'
 WHERE user_id='00000000-0000-4000-8000-000000000104';
UPDATE public.mobility_driver_compliance SET license_valid_through=CURRENT_DATE-1
 WHERE driver_id='00000000-0000-4000-8000-000000000101';
SET ROLE service_role;
DO $expired$
BEGIN
 IF public.mobility_stage_driver_current_license_approved(
 '00000000-0000-4000-8000-000000000101') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G280 expired compliance still grants current license'; END IF;
 RAISE NOTICE 'G280 PASS: private status, Driver isolation, KYC fail-closed, independent G27, revocation and expiry';
END $expired$;
RESET ROLE;
