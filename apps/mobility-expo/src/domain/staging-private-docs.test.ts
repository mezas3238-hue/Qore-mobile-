import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../docs/backend/staging_only/G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql',import.meta.url),'utf8');
const noncomments=sql.replace(/^--.*$/gm,'');

test('staging bucket must remain private, max 5 MiB, JPG/PNG only',()=>{
 assert.match(sql,/STAGING-ONLY/);
 assert.match(noncomments,/mobility-staging-driver-evidence/);
 assert.match(noncomments,/false,5242880/);
 assert.match(noncomments,/ARRAY\['image\/jpeg','image\/png'\]::text\[\]/);
});
test('document insertion must prove JWT owner, owner_id and owner-only folder',()=>{
 assert.match(noncomments,/FOR INSERT TO authenticated/);
 assert.match(noncomments,/owner_id=auth\.uid\(\)::text/);
 assert.match(noncomments,/storage\.foldername\(name\)=ARRAY\[auth\.uid\(\)::text\]/);
 assert.match(noncomments,/rostro_selfie\)-\[A-Za-z0-9_-\]\{12,80\}/);
 for(const kind of ['licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie']){
  assert.ok(noncomments.includes(kind),'missing evidence kind: '+kind);
 }
});
test('no anonymous, global-read, UPDATE or DELETE policy',()=>{
 assert.match(noncomments,/FOR SELECT TO authenticated/);
 assert.doesNotMatch(noncomments,/\b(?:FOR INSERT TO anon|FOR SELECT TO anon|FOR UPDATE|FOR DELETE|TO public)\b/i);
 assert.doesNotMatch(noncomments,/\bpublic\s*=\s*true\b/i);
});
test('migration refuses populated/foreign storage and checks postconditions before COMMIT',()=>{
 assert.match(noncomments,/count\(\*\) FROM auth\.users/);
 assert.match(noncomments,/count\(\*\) FROM storage\.buckets/);
 assert.match(noncomments,/count\(\*\) FROM storage\.objects/);
 assert.match(noncomments,/R(?:AISE) EXCEPTION 'Expected an empty isolated STAGING storage/);
 assert.match(noncomments,/STAGING document bucket verification failed, roll back/);
 assert.ok(noncomments.indexOf('DO $post$')<noncomments.lastIndexOf('COMMIT;'));
});
