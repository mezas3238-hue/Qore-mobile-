import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSupabaseClientConfig} from './supabase-public-config.ts';
const url='https://abcdefghijklmnopqrst.supabase.co';
const makeJwt=(role:string)=>['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({role,iss:'supabase'})).toString('base64url'),'signature'].join('.');
test('acepta solamente claves Supabase publicables y anon legítimas',()=>{
 assert.equal(safeSupabaseClientConfig(url,'sb_publishable_TEST_private_reference_2026'),true);
 assert.equal(safeSupabaseClientConfig(url,makeJwt('anon')),true);
});
test('prohíbe claves service_role, secret, autenticado o JWT deformes',()=>{
 for(const key of [makeJwt('service_role'),makeJwt('authenticated'),'sb_secret_THIS_IS_NOT_PUBLIC_2026','secreto','a.b.c','sb_publishable_x']){
  assert.equal(safeSupabaseClientConfig(url,key),false,key);
 }
});
test('exige HTTPS Supabase cloud y sin URL inyectada',()=>{
 const key='sb_publishable_TEST_private_reference_2026';
 for(const uri of ['http://abcdefghijklmnopqrst.supabase.co','https://evil.example','https://admin:pass@abcdefghijklmnopqrst.supabase.co','https://abcdefghijklmnopqrst.supabase.co/path','https://abcdefghijklmnopqrst.supabase.co?token=abc','https://abcdefghijklmnopqrst.supabase.co:8080']){
  assert.equal(safeSupabaseClientConfig(uri,key),false,uri);
 }
});
test('cliente se cierra sin configurar URL/clave',()=>{
 assert.equal(safeSupabaseClientConfig(undefined,undefined),false);
 assert.equal(safeSupabaseClientConfig(url,undefined),false);
 assert.equal(safeSupabaseClientConfig(undefined,'sb_publishable_TEST_private_reference_2026'),false);
});
