import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../supabase/staging_sql/g246_private_auto_service_rpcs.sql',import.meta.url),'utf8');
test('G246 keeps original AUTO request, transition and one-winner private offer functions',()=>{
 for(const fn of [
  'mobility_stage_auto_demo_request','mobility_stage_auto_demo_transition',
  'mobility_stage_auto_demo_offer','mobility_stage_auto_demo_decline_offer',
  'mobility_stage_auto_demo_accept_offer'
 ])assert(s.includes('CREATE FUNCTION public.'+fn+'('),fn);
 assert(!s.includes('CREATE FUNCTION public.mobility_stage_auto_demo_accept('));
 assert(s.includes("RAISE EXCEPTION 'G246"));
 assert(s.includes('FOR UPDATE'));
 assert(s.includes('expires_at<=statement_timestamp()'));
 assert(s.includes('decision_key'));
});
test('G246 can only be invoked by service role, no SECURITY DEFINER or public grants',()=>{
 assert.equal((s.match(/CREATE FUNCTION public\./g)||[]).length,5);
 assert.equal((s.match(/REVOKE EXECUTE ON FUNCTION public\./g)||[]).length,5);
 assert.equal((s.match(/GRANT EXECUTE ON FUNCTION public\./g)||[]).length,5);
 assert(s.includes('SECURITY INVOKER'));
 assert(!s.includes('SECURITY DEFINER'));
 assert(!s.includes('TO authenticated;') && !s.includes('TO anon;'));
 assert(!s.includes('GRANT ALL'));
});
