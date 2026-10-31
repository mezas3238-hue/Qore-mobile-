import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/staging_sql/qore_staging_merchant_authorized_rpcs.sql',import.meta.url),'utf8');
const names=["mobility_stage_merchant_onboarding_request","mobility_stage_merchant_review","mobility_stage_merchant_branch_upsert","mobility_stage_catalog_item_upsert","mobility_stage_merchant_order_request","mobility_stage_merchant_order_transition","mobility_stage_merchant_order_attach_delivery"];
test('7 merchants ops use only private definer and public invoker wrappers',()=>{
 for(const name of names){
  assert(sql.includes('CREATE FUNCTION qore_stage_internal.'+name+'('),name);
  assert(sql.includes('CREATE FUNCTION public.'+name+'('),name);
  assert(sql.includes('REVOKE ALL ON FUNCTION public.'+name+'('),name);
  assert(sql.includes('GRANT EXECUTE ON FUNCTION public.'+name),name);
 }
 assert.equal((sql.match(/SECURITY DEFINER SET search_path=''/g)||[]).length,7);
 assert.equal((sql.match(/SECURITY INVOKER SET search_path=''/g)||[]).length,7);
 assert(sql.includes("REVOKE ALL ON SCHEMA qore_stage_internal FROM PUBLIC,anon,authenticated"));
 assert(!sql.includes('GRANT INSERT ON public.mobility_stage_merchant'));
});
test('Commercial privileges retain denial gates, identity and actor validation',()=>{
 assert(sql.includes('Merchant direct write lockdown was altered; abort'));
 assert(sql.includes('Verified passenger buyer required'));
 assert(sql.includes("role='admin'::public.app_role"));
 assert(sql.includes("role='passenger'::public.app_role"));
 assert(sql.includes("m.status='approved'"));
 assert(sql.includes("status<>'approved'"));
 assert(sql.includes('FOR UPDATE'));
 assert(sql.includes('Conflicting merchant order request key'));
 assert(sql.includes("stock_units=stock_units-qty"));
 assert(sql.includes('stock_units=c.stock_units+l.quantity'));
 assert(!sql.includes('CREATE USER') && !sql.includes('CREATE ROLE') && !sql.includes('GRANT ALL ON public.mobility_stage'));
});
test('Source migration is atomic and aborts duplicate schema and privilege drift',()=>{
 assert(sql.trim().endsWith('COMMIT;'));
 assert(sql.includes('BEGIN;')&&sql.includes('to_regnamespace'));
 assert(sql.includes('OR has_table_privilege'));
 assert(sql.includes('qore_stage_internal'));
});
