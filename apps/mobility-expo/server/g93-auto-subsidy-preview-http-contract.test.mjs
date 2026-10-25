import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
import {createQoreG73AutoRepository} from './g73-auto-f1-repository.mjs';
const spec=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url)));
const actor='73730000-0000-4737-8737-000000000001';
const quoteId='73730000-0000-4737-8737-000000000015';
const campaignId='73730000-0000-4737-8737-000000000020';
const path='/v1/staging/rider/auto/prequotes/'+quoteId+'/subsidy';
const time=1900000000000;
const preview={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:actor,
 quoteId,campaignId,serviceKind:'AUTO_RIDE',currency:'PYG',originalFareGs:30000,
 commissionBps:1500,subsidyBps:1000,nominalCommissionGs:4500,
 customerSubsidyGs:3000,customerPaysGs:27000,driverReceivesGs:25500,
 platformRetainsGs:1500,fareVersion:'PY_AUTO_OWNER_60_QA_V1',
 expiresAt:time+90000,serverPersisted:true};
const req=(headers={authorization:'Bearer '+'x'.repeat(40)},body=null)=>
 ({method:'POST',path,headers,body});
function fixture(readSubsidyPreview=async()=>preview,extra={}){
 const calls=[];
 const gw=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:()=>time,
  verifyAccessToken:async()=>({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:x=>{calls.push(x);return true;},
  resolveVerifiedRoute:async()=>{},registerRoute:async()=>{},
  loadRoute:async()=>{},quoteRoute:async()=>{},loadQuote:async()=>{},
  bookQuote:async()=>{},reconcileBooking:async()=>{},
  readSubsidyPreview,...extra
 });
 return {gw,calls};
}
test('G93 contract is sealed, owner-only, QA-only and disjoint from G73 original quote',()=>{
 assert.equal(spec.info.version,'1.0.0-g93');
 const op=spec.paths['/v1/staging/rider/auto/prequotes/{quoteId}/subsidy']?.post;
 assert.ok(op);
 assert.equal(op['x-qore-runtime-wired'],false);
 assert.deepEqual(op.security,[{BearerAuth:[]}]);
 assert.equal(op.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/G93AutoSubsidyPreview');
 const dto=spec.components.schemas.G93AutoSubsidyPreview;
 assert.equal(dto.additionalProperties,false);
 assert.deepEqual(dto.required,Object.keys(dto.properties));
 for(const key of ['driverId','gps','amountFromClient','authorization',
 'secret','customerPhone','serviceRole'])assert.equal(dto.properties[key],undefined);
});
test('G93 quote reads server-persisted subsidy and never accepts caller-supplied fare',async()=>{
 const {gw,calls}=fixture();
 assert.deepEqual(await gw(req()),{status:200,body:preview});
 assert.equal(calls[0].operation,'g93_subsidy_preview');
 assert.equal((await gw(req(undefined,{amountGs:1}))).status,400);
 assert.equal((await gw(req(undefined,{subsidyBps:0}))).status,400);
 assert.equal((await gw(req({}))).status,401);
 assert.equal((await fixture(async()=>preview,{authorizePassenger:async()=>false}).gw(req())).status,403);
});
test('G93 fails closed on altered finance, Owner, expiry or service',async()=>{
 for(const patch of [
  {ownerId:quoteId},{quoteId:campaignId},{campaignId:'bad'},
  {serviceKind:'MOTO_RIDE'},{serviceKind:'AUTO_DELIVERY'},
  {commercialEnabled:true},{customerSubsidyGs:2000},{driverReceivesGs:20000},
  {customerPaysGs:27500},{nominalCommissionGs:2500},
  {platformRetainsGs:2000},{commissionBps:1200},{subsidyBps:900},
  {originalFareGs:0},{expiresAt:time-1},{expiresAt:time+99999999},
  {fareVersion:'../bad'},{driverId:campaignId}
 ]){
  const r=await fixture(async()=>({...preview,...patch})).gw(req());
  assert.equal(r.status,409,JSON.stringify(patch));
  assert.doesNotMatch(JSON.stringify(r),/27000|25500/);
 }
});
test('G93 unavailable campaign or SQL error remains closed; foreign quote is 404',async()=>{
 assert.equal((await fixture(null).gw(req())).status,503);
 assert.equal((await fixture(async()=>{throw Error('PG_SECRET');}).gw(req())).status,503);
 assert.equal((await fixture(async()=>null).gw(req())).status,404);
 assert.equal((await fixture(async()=>preview,{allowRequest:()=>false}).gw(req())).status,429);
});
test('G93 SQL repo adapter sends owner-scope only, no payment fields or Driver ID',async()=>{
 const calls=[];
 const repo=createQoreG73AutoRepository({rpc:async (name,params)=>{
  calls.push({name,params});
  return {data:preview,error:null};
 }});
 assert.deepEqual(await repo.previewAutoSubsidy({actorId:actor,quoteId}),preview);
 assert.deepEqual(calls[0],{name:'mobility_stage_g93_preview_auto_qa',
  params:{_passenger_id:actor,_quote_id:quoteId}});
 await assert.rejects(()=>repo.previewAutoSubsidy({actorId:'wrong',quoteId}));
});
