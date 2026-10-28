import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
import {createQoreG73AutoRepository} from './g73-auto-f1-repository.mjs';
const spec=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url)));
const owner='94940000-0000-4949-8949-000000000001';
const tripId='94940000-0000-4949-8949-000000000004';
const quoteId='94940000-0000-4949-8949-000000000005';
const bookKey='94940000-0000-4949-8949-000000000012';
const path='/v1/staging/rider/auto/bookings/'+bookKey+'/financial-status';
const reserved={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
 bookingKey:bookKey,tripId,quoteId,tripState:'searching',tripRevision:1,
 financialState:'RESERVED_QA',customerPaysGs:13680,driverReceivesGs:12920,
 customerSubsidyGs:1520,platformRetainsGs:760,
 originalEntriesBalanced:true,reversalEntriesBalanced:false,
 pspCollected:false,pspRefunded:false,serverPersisted:true};
const req=(body=undefined,headers={authorization:'Bearer '+'x'.repeat(40)})=>
 ({method:'GET',path,headers,body});
function fixture(readAutoFinancialState=async()=>reserved,patch={}){
 const calls=[];
 const gw=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:()=>1900000000000,
  verifyAccessToken:async()=>({id:owner,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:x=>{calls.push(x);return true;},
  resolveVerifiedRoute:async()=>{},registerRoute:async()=>{},loadRoute:async()=>{},
  quoteRoute:async()=>{},loadQuote:async()=>{},bookQuote:async()=>{},
  reconcileBooking:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:owner,requestKey:bookKey,quoteId,routeId:tripId,
   tripId,revision:1,serverPersisted:true,status:'ACCEPTED_QA'}),
  readAutoFinancialState,...patch
 });
 return {gw,calls};
}
test('G94 sealed financial contract cannot represent PSP charge or refund',()=>{
 assert.match(spec.info.version,/^1\.0\.0-g\d+$/);
 assert.ok(Number(spec.info.version.split('-g')[1])>=94);
 const op=spec.paths['/v1/staging/rider/auto/bookings/{bookingKey}/financial-status'].get;
 assert.equal(op['x-qore-runtime-wired'],false);
 assert.deepEqual(op.security,[{BearerAuth:[]}]);
 assert.equal(op.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/G94AutoFinancialState');
 const sch=spec.components.schemas.G94AutoFinancialState;
 assert.deepEqual(sch.required,Object.keys(sch.properties));
 assert.equal(sch.additionalProperties,false);
 assert.deepEqual(sch.properties.pspCollected,{type:'boolean',const:false});
 assert.deepEqual(sch.properties.pspRefunded,{type:'boolean',const:false});
 for(const forbidden of ['driverId','gps','phone','serviceRole','pspToken','card'])
  assert.equal(sch.properties[forbidden],undefined);
});
test('G94 owner sees same stored trip, reserved and cancelled financial status',async()=>{
 const f=fixture();
 const first=await f.gw(req());
 assert.deepEqual(first,{status:200,body:reserved});
 assert.equal(f.calls[0].operation,'g94_financial_status');
 const voided={...reserved,tripState:'cancelled',tripRevision:2,
  financialState:'VOIDED_QA',reversalEntriesBalanced:true};
 assert.deepEqual(await fixture(async()=>voided).gw(req()),{status:200,body:voided});
 const completed={...reserved,tripState:'completed',tripRevision:5,
  financialState:'COMPLETED_UNSETTLED_QA'};
 assert.deepEqual(await fixture(async()=>completed).gw(req()),
  {status:200,body:completed});
});
test('G94 fail-closed if financial status is forged, unbalanced or claims PSP activity',async()=>{
 for(const x of [
  {ownerId:tripId},{tripId:'invalid'},{quoteId:'fake'}, {bookingKey:quoteId},
  {commercialEnabled:true},{originalEntriesBalanced:false},
  {pspCollected:true},{pspRefunded:true},{financialState:'PAID'},
  {financialState:'VOIDED_QA'},{reversalEntriesBalanced:true},
  {tripState:'cancelled'},{tripState:'completed'},{customerPaysGs:-1},
  {driverReceivesGs:1.5},{tripRevision:0},{extra:'leak'}
 ]){
  const answer=await fixture(async()=>({...reserved,...x})).gw(req());
  assert.equal(answer.status,409,JSON.stringify(x));
  assert.doesNotMatch(JSON.stringify(answer),/13680|12920/);
 }
});
test('G94 rejects forged caller body, anonymous Passenger, unavailable DB and stale role',async()=>{
 assert.equal((await fixture().gw(req({amountGs:1}))).status,400);
 assert.equal((await fixture().gw(req(undefined,{}))).status,401);
 assert.equal((await fixture(async()=>reserved,{authorizePassenger:async()=>false}).gw(req())).status,403);
 assert.equal((await fixture(null).gw(req())).status,503);
 assert.equal((await fixture(async()=>{throw Error('SENSITIVE_DB_ERROR');}).gw(req())).status,503);
 assert.equal((await fixture(async()=>null).gw(req())).status,404);
 assert.equal((await fixture(async()=>reserved,{allowRequest:()=>false}).gw(req())).status,429);
});
test('G94 SQL adapter supplies only server authenticated actor and booking key',async()=>{
 const seen=[];
 const r=createQoreG73AutoRepository({rpc:async(name,args)=>{
  seen.push({name,args});return {data:reserved,error:null};
 }});
 assert.deepEqual(await r.autoFinancialState({actorId:owner,requestKey:bookKey}),reserved);
 assert.deepEqual(seen[0],{name:'mobility_stage_g94_auto_financial_state_qa',
  args:{_passenger_id:owner,_booking_key:bookKey}});
 await assert.rejects(r.autoFinancialState({actorId:'driver',requestKey:bookKey}));
});
