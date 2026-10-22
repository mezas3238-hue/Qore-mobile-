import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/backend/staging_only/G12_DELIVERY_PUSH_CLAIM_ACK_POSTGRES_CI_ONLY.sql',import.meta.url),'utf8');
test('G12 SQL uses existing G10 outbox and atomic skip locked claim',()=>{
 assert.match(sql,/ALTER TABLE public\.mobility_stage_delivery_offer_outbox/);
 assert.match(sql,/FOR UPDATE OF o SKIP LOCKED LIMIT 1/);
 assert.match(sql,/o\.claimed_at IS NULL/);
 assert.match(sql,/f\.status='offered' AND d\.status='requested'/);
 assert.match(sql,/f\.expires_at>pg_catalog\.clock_timestamp\(\)\+interval '3 seconds'/);
});
test('G12 provider ACK is worker-owned and never claims device receipt',()=>{
 assert.match(sql,/o\.claimed_by=_worker_id/);
 assert.match(sql,/provider_ticket_id=_ticket_id/);
 assert.doesNotMatch(sql,/SET receipt_confirmed_at/);
 assert.match(sql,/accepted_for_processing_at IS NULL/);
});
test('G12 RPCs are service-role only',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mobility_stage_claim_delivery_push\(uuid\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mobility_stage_ack_delivery_push\(uuid,uuid,text\)/);
 assert.match(sql,/TO service_role/);
 assert.doesNotMatch(sql,/GRANT EXECUTE[^;]+TO authenticated/);
});
