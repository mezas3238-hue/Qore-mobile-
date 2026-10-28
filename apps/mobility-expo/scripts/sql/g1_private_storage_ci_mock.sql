\set ON_ERROR_STOP on
-- Ephemeral PostgreSQL 16 CI ONLY: miniature Supabase Storage contract.
-- Never execute this fixture in the actual Supabase storage schema.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
 id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false,
 file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket_id text NOT NULL REFERENCES storage.buckets(id),
 name text NOT NULL, owner_id text,
 UNIQUE(bucket_id,name)
);
CREATE FUNCTION storage.foldername(_name text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=''
AS $fn$
 SELECT CASE WHEN position('/' IN _name)=0 THEN ARRAY[]::text[]
  ELSE (string_to_array(_name,'/'))[1:(array_length(string_to_array(_name,'/'),1)-1)]
 END
$fn$;
GRANT USAGE ON SCHEMA storage TO authenticated,service_role;
GRANT SELECT,INSERT ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects,storage.buckets TO service_role;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- G1_PRIVATE_DOCS_BUCKET migration is executed by parent smoke test.
