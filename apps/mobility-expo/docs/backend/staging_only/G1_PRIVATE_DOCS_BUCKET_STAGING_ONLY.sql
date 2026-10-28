-- G1 STAGING-ONLY private driver-docs bucket. Never apply to old Lovable.
-- Supabase Storage API owns object inserts and sets owner_id from verified JWT.
-- Valid document bytes, license authenticity, and insurance must be verified in server.
BEGIN;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM auth.users)<>0
    OR (SELECT count(*) FROM storage.buckets)<>0
    OR (SELECT count(*) FROM storage.objects)<>0
    OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects')
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity=true)
 THEN
  RAISE EXCEPTION 'Expected an empty isolated STAGING storage before setup';
 END IF;
END
$guard$;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES (
 'mobility-staging-driver-evidence',
 'mobility-staging-driver-evidence',false,5242880,
 ARRAY['image/jpeg','image/png']::text[]
);
-- Never permit user-selected folder IDs or write to another owner.
CREATE POLICY mobility_stage_evidence_owner_insert
 ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (
  bucket_id='mobility-staging-driver-evidence'
  AND auth.uid() IS NOT NULL
  AND owner_id=auth.uid()::text
  AND storage.foldername(name)=ARRAY[auth.uid()::text]
  AND name ~ ('^' || auth.uid()::text ||
    '/(licencia|identidad_frente|identidad_dorso|cedula_verde|habilitacion|seguro|inspeccion|rostro_selfie)-[A-Za-z0-9_-]{12,80}\.(jpg|jpeg|png)$')
 );
CREATE POLICY mobility_stage_evidence_owner_select
 ON storage.objects FOR SELECT TO authenticated
 USING (
  bucket_id='mobility-staging-driver-evidence'
  AND auth.uid() IS NOT NULL
  AND owner_id=auth.uid()::text
  AND storage.foldername(name)=ARRAY[auth.uid()::text]
 );
DO $post$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM storage.buckets
  WHERE id='mobility-staging-driver-evidence' AND public=false
   AND file_size_limit=5242880
   AND allowed_mime_types=ARRAY['image/jpeg','image/png']::text[])
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage'
     AND tablename='objects' AND policyname LIKE 'mobility_stage_evidence_%')<>2
 OR (SELECT count(*) FROM storage.objects)<>0
 THEN RAISE EXCEPTION 'STAGING document bucket verification failed, roll back'; END IF;
END
$post$;
COMMIT;
