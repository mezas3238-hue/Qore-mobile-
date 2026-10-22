import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G7_FARES_SIMULATED_PAYMENTS_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
function fn(name){
 const start=sql.indexOf('CREATE FUNCTION public.'+name+'(');
 assert.notEqual(start,-1,'Missing SQL function '+name);
 const end=sql.indexOf('$body$;',start);
 assert.notEqual(end,-1,'Unclosed SQL function '+name);
 return sql.slice(start,end);
}
test('G7 is CI-only and exposes no real payment rail or client mutation',()=>{
 assert.match(sql,/POSTGRESQL 16 DISPOSABLE CI ONLY/);
 assert.match(sql,/\('SIMULATED_CASH','SIMULATED_CARD'\)/);
 assert.doesNotMatch(sql,/STRIPE|BANCARD|PAGOPAR|CREDIT_CARD/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE).*authenticated/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mobility_stage_payment_authorize/);
});
test('G7 fare uses immutable server rule, integer PYG rounding and excludes toll commission',()=>{
 const body=fn('mobility_stage_fare_quote');
 assert.match(body,/active=true/);
 assert.match(body,/valid_from<=statement_timestamp\(\)/);
 assert.match(body,/distance_charge:=\(_distance_meters::bigint\*rule\.per_km_pyg\+500\)\/1000/);
 assert.match(body,/commission:=\(subtotal\*rule\.commission_bps\+5000\)\/10000/);
 assert.match(body,/total:=subtotal\+_tolls_pyg/);
 assert.match(body,/provider:=total-commission/);
});
test('G7 binds quote to owned durable service and captures only after completion',()=>{
 const quote=fn('mobility_stage_fare_quote');
 const payment=fn('mobility_stage_payment_transition');
 assert.match(quote,/t\.passenger_id=_customer_id/);
 assert.match(quote,/d\.sender_id=_customer_id/);
 assert.match(quote,/o\.buyer_id=_customer_id/);
 assert.match(payment,/status='completed'/);
 assert.match(payment,/status='delivered'/);
 assert.match(payment,/p\.status='authorized' AND service_complete/);
});
test('G7 capture and refund create canonical opposite three-line ledger entries',()=>{
 const body=fn('mobility_stage_payment_transition');
 assert.match(body,/synthetic_cash_clearing/);
 assert.match(body,/synthetic_provider_payable/);
 assert.match(body,/synthetic_platform_commission/);
 assert.match(body,/CASE WHEN _action='capture' THEN 'debit' ELSE 'credit' END/);
 assert.match(sql,/UNIQUE\(payment_id,event,sequence\)/);
});

