import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/backend/staging_only/G13_DELIVERY_PUSH_FENCED_DISPOSABLE_CI_ONLY.sql',import.meta.url),'utf8');
const ci=readFileSync(new URL('../../../.github/workflows/mobility-g4-postgres-disposable.yml',import.meta.url),'utf8');
test('G13 explicitly revokes legacy unfenced RPCs and requires claim nonce',()=>{
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.mobility_stage_claim_delivery_push\(uuid\) FROM service_role/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.mobility_stage_ack_delivery_push\(uuid,uuid,text\) FROM service_role/);
 assert.match(sql,/claim_nonce=pg_catalog\.gen_random_uuid\(\)/);
 assert.match(sql,/o\.claim_nonce=_claim_nonce/);
 assert.match(sql,/o\.claimed_at>pg_catalog\.clock_timestamp\(\)-interval '12 seconds'/);
});
test('G13 never automatically reclaims a sending row and never treats ACK as device receipt',()=>{
 assert.match(sql,/o\.send_started_at IS NULL/);
 assert.match(sql,/FOR UPDATE OF o SKIP LOCKED LIMIT 1/);
 assert.match(sql,/SET send_started_at=pg_catalog\.clock_timestamp\(\)/);
 assert.match(sql,/SET accepted_for_processing_at=pg_catalog\.clock_timestamp\(\)/);
 assert.doesNotMatch(sql,/SET receipt_confirmed_at/);
 assert.match(sql,/FOR UPDATE OF o SKIP LOCKED LIMIT 100/);
});
test('G13 RPC permissions remain service-only and CI runs against real migration chain',()=>{
 for(const fn of [
  'mobility_stage_claim_delivery_push_v2\\(uuid\\)',
  'mobility_stage_begin_delivery_push_v2\\(uuid,uuid,uuid\\)',
  'mobility_stage_ack_delivery_push_v2\\(uuid,uuid,uuid,text\\)',
  'mobility_stage_expire_delivery_push_claims_v2\\(\\)'
 ]){
  assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+fn));
 }
 assert.doesNotMatch(sql,/GRANT EXECUTE[^;]+TO authenticated/);
 assert.match(ci,/G13_DELIVERY_PUSH_FENCED_DISPOSABLE_CI_ONLY\.sql/);
 assert.match(ci,/G13_FENCED_DELIVERY_PUSH_FULL_CHAIN_ASSERT_POSTGRES_CI_ONLY\.sql/);
});
