import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261016192600_p0_lockdown_trips_and_roles.sql',import.meta.url),'utf8');
const rpc=['request_ride','accept_ride','advance_ride','cancel_ride','set_driver_availability','get_nearby_requests','get_ride_counterpart','rate_ride'];
test('migración P0 de seguridad cubre las 8 RPC sin habilitar viajes',()=>{
 for(const fn of rpc){
  assert.match(sql,new RegExp('REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.'+fn+'\\s*\\([^;]+?\\)\\s+FROM\\s+PUBLIC,\\s*anon,\\s*authenticated\\s*;','i'),fn+' no bloqueada');
 }
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
 assert.doesNotMatch(sql,/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(?:request_ride|accept_ride)[\s\S]*?TO\s+(?:anon|authenticated)\s*;/i);
});
test('helpers de roles JWT sujetos al usuario actual, no a UUID arbitrario',()=>{
 assert.match(sql,/_user_id\s*=\s*auth\.uid\(\)/);
 assert.match(sql,/_uid\s*=\s*auth\.uid\(\)/);
 for(const name of ['has_role','is_approved_driver','handle_new_user']){
  assert.match(sql,new RegExp('REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.'+name+'\\s*\\([^;]+?\\)\\s+FROM\\s+PUBLIC,\\s*anon\\s*;','i'));
 }
});
test('bloqueo no toca registros ni retira rol admin de control manual',()=>{
 assert.doesNotMatch(sql,/DROP\s+TABLE|TRUNCATE\s+|DELETE\s+FROM|UPDATE\s+public\.fare_configs/i);
 assert.doesNotMatch(sql,/REVOKE[^;]*(?:submit_driver_application|admin_review_driver|handle_new_user\s*\([^)]*\)\s+FROM\s+authenticated)/i);
});
test('staging smoke impide proyecto Lovable, no interpreta publishable key como JWT',()=>{
 const code=readFileSync(new URL('../../scripts/staging-auth-readonly.mjs',import.meta.url),'utf8');
 assert.match(code,/ref==='qdqrlgzlotnfdxzpacxs'/);
 assert.match(code,/if\(token\)headers\.Authorization/);
 assert.match(code,/actor\.id,undefined/);
});
