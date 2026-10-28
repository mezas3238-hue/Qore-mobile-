import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G9_MERCHANT_MANAGEMENT_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
function fn(name){const start=sql.indexOf('CREATE FUNCTION public.'+name+'(');
 assert.notEqual(start,-1);const end=sql.indexOf('$body$;',start);assert.notEqual(end,-1);
 return sql.slice(start,end);}
test('G9 is disposable CI-only with private append-only management audit',()=>{
 assert.match(sql,/POSTGRESQL 16 DISPOSABLE CI ONLY/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE).*authenticated/);
 assert.doesNotMatch(sql,/GRANT (UPDATE|DELETE) ON public\.mobility_stage_merchant_management_events/);
});
test('onboarding derives owner and cannot self-approve',()=>{
 const request=fn('mobility_stage_merchant_onboarding_request');
 const review=fn('mobility_stage_merchant_review');
 assert.match(request,/role='passenger'::public\.app_role/);
 assert.match(request,/INSERT INTO public\.mobility_stage_merchant_staff/);
 assert.match(review,/role='admin'::public\.app_role/);
 assert.match(review,/merchant\.status<>'pending'/);
 assert.match(review,/'approved'::public\.mobility_stage_merchant_status/);
});
test('branch and catalog management require persisted owner or manager membership',()=>{
 for(const name of ['mobility_stage_merchant_branch_upsert','mobility_stage_catalog_item_upsert']){
  const body=fn(name);assert.match(body,/staff_role IN \('owner','manager'\)/);
  assert.match(body,/merchant\.status<>'approved'/);
  assert.match(body,/request_key=_request_key/);
 }
});
test('regulated catalog remains fail-closed outside pharmacy',()=>{
 const body=fn('mobility_stage_catalog_item_upsert');
 assert.match(body,/_item_class='PHARMACY_OTC' AND merchant\.kind<>'PHARMACY'/);
 assert.doesNotMatch(sql,/PRESCRIPTION|CONTROLLED/);
});
