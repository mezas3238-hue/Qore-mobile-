import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G6_MERCHANT_ORDERS_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
function fn(name){
 const start=sql.indexOf('CREATE FUNCTION public.'+name+'(');
 assert.notEqual(start,-1,'Missing SQL function '+name);
 const end=sql.indexOf('$body$;',start);
 assert.notEqual(end,-1,'Unclosed SQL function '+name);
 return sql.slice(start,end);
}

test('G6 is CI-only, server-write-only and uses participant RLS',()=>{
 assert.match(sql,/POSTGRESQL 16 DISPOSABLE CI ONLY/);
 assert.match(sql,/ALTER TABLE public\.mobility_stage_merchant_orders ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/buyer_id=auth\.uid\(\) OR EXISTS/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mobility_stage_merchant_order_request/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE).*authenticated/);
 assert.match(sql,/mobility_stage_order_line_participant_read/);
});

test('G6 order request locks inventory, snapshots price and rejects uncontrolled pharmacy classes',()=>{
 const body=fn('mobility_stage_merchant_order_request');
 assert.match(body,/WHERE id=_branch_id FOR UPDATE/);
 assert.match(body,/WHERE id=item_id FOR UPDATE/);
 assert.match(body,/item\.stock_units<qty/);
 assert.match(body,/SET stock_units=stock_units-qty/);
 assert.match(body,/item\.unit_price_pyg\*qty/);
 assert.match(sql,/\('GENERAL','PHARMACY_OTC'\)/);
 assert.doesNotMatch(sql,/PRESCRIPTION|CONTROLLED/);
});

test('G6 cancellation restores stock exactly once through idempotent events',()=>{
 const body=fn('mobility_stage_merchant_order_transition');
 assert.match(body,/WHERE id=_order_id FOR UPDATE/);
 assert.match(body,/WHERE request_key=_request_key/);
 assert.match(body,/IF target='cancelled' THEN/);
 assert.match(body,/stock_units=c\.stock_units\+l\.quantity/);
 assert.match(sql,/UNIQUE\(order_id,order_revision\)/);
});

test('G6 links only matching G5 delivery and completes after delivery proof state',()=>{
 const attach=fn('mobility_stage_merchant_order_attach_delivery');
 const transition=fn('mobility_stage_merchant_order_transition');
 assert.match(attach,/d\.sender_id<>o\.buyer_id/);
 assert.match(attach,/d\.requested_vehicle_kind<>o\.requested_vehicle_kind/);
 assert.match(attach,/d\.pickup_tag<>/);
 assert.match(attach,/d\.category<>CASE/);
 assert.match(transition,/delivery_status='picked_up'/);
 assert.match(transition,/delivery_status='delivered'/);
});

