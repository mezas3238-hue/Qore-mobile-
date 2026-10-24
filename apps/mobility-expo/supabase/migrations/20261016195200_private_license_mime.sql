-- QORE Mobility G1 DOC-001: private driver-docs MIME restriction.
-- Reviewed: private bucket, limit 5 MiB, MIME NULL, no passenger profiles.
BEGIN;
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='driver-docs' AND name='driver-docs' AND public=false
      AND file_size_limit=5242880
  ) THEN
    RAISE EXCEPTION 'driver-docs has changed or is public; abort';
  END IF;
END;
$guard$;
UPDATE storage.buckets
SET allowed_mime_types=ARRAY['image/jpeg','image/png']::text[]
WHERE id='driver-docs' AND name='driver-docs' AND public=false
  AND file_size_limit=5242880;
COMMIT;
