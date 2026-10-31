import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(x)=>readFileSync(new URL('../supabase/staging_sql/'+x,import.meta.url),'utf8');
const delivery=read('g247_delivery_private_offer_rpcs.sql');
const finance=read('g248_simulated_finance_rpcs.sql');
const deliveryFns=["mobility_stage_delivery_courier_preflight","mobility_stage_delivery_request","mobility_stage_delivery_transition","mobility_stage_delivery_offer","mobility_stage_delivery_decline_offer","mobility_stage_delivery_accept_offer"];
const financeFns=["mobility_stage_fare_quote","mobility_stage_payment_authorize","mobility_stage_payment_transition"];
test('G247 delivery dispatch and custody require one-winner offer and courier preflight',()=>{
 assert.equal((delivery.match(/CREATE FUNCTION public\./g)||[]).length,deliveryFns.length);
 for(const n of deliveryFns)assert(delivery.includes('CREATE FUNCTION public.'+n+'('),n);
 assert(!delivery.includes('CREATE FUNCTION public.mobility_stage_delivery_accept('));
 assert(delivery.includes('FOR UPDATE'));
 assert(delivery.includes('mobility_stage_delivery_courier_preflight'));
 assert(delivery.includes('expires_at<=statement_timestamp()'));
 assert(delivery.includes("RAISE EXCEPTION 'G247"));
});
test('G248 finance only uses synthetic methods and balanced ledger',()=>{
 assert.equal((finance.match(/CREATE FUNCTION public\./g)||[]).length,financeFns.length);
 for(const n of financeFns)assert(finance.includes('CREATE FUNCTION public.'+n+'('),n);
 for(const term of ["SIMULATED_CASH","SIMULATED_CARD","synthetic_cash_clearing",
   "synthetic_provider_payable","synthetic_platform_commission","commission_pyg"])
 assert(finance.includes(term),term);
 assert(finance.includes('pg_catalog.pg_advisory_xact_lock'));
 assert(finance.includes("RAISE EXCEPTION 'G248"));
});
test('all operations are service-role only, SECURITY INVOKER and no customer writes',()=>{
 for(const [s,fns] of [[delivery,deliveryFns],[finance,financeFns]]){
  assert.equal((s.match(/REVOKE EXECUTE ON FUNCTION public\./g)||[]).length,fns.length);
  assert.equal((s.match(/GRANT EXECUTE ON FUNCTION public\./g)||[]).length,fns.length);
  assert(!s.includes('SECURITY DEFINER'));
  assert(!s.includes('GRANT ALL'));
  assert(!s.includes('TO authenticated;'));
  assert(!s.includes('TO anon;'));
  assert(!s.includes('CREATE TABLE public.'));
  assert(!s.includes('CREATE ROLE'));
 }
});
