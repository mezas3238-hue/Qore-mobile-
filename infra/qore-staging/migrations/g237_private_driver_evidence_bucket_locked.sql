-- G237: private STAGING evidence bucket. No user upload or read policy yet.
-- It remains intentionally inaccessible until Auth disable_signup, trusted
-- KYC processing, scans, expiry, and Storage session authorization are proven.
DO $check$
BEGIN
 IF to_regclass('storage.buckets') IS NULL OR
    to_regclass('storage.objects') IS NULL OR
    EXISTS(SELECT 1 FROM storage.buckets WHERE id='mobility-staging-driver-evidence') OR
    (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'G237 requires empty isolated Supabase STAGING Storage'; END IF;
END
$check$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('mobility-staging-driver-evidence',
       'mobility-staging-driver-evidence',false,5242880,
       ARRAY['image/jpeg','image/png']::text[]);
-- No storage.objects policies. Default RLS denies all upload/read by mobile.
