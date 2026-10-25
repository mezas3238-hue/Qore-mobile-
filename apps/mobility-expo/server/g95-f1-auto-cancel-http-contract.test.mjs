import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
import {createQoreG73AutoRepository} from './g73-auto-f1-repository.mjs';
const spec=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url)));
const actor='95950000-0000-4959-8959-000000000001';
const stranger='95950000-0000-4959-8959-000000000003';
const bookingKey='95950000-0000-4959-8959-000000000012';
const key='95950000-0000-4959-8959-000000000013';
const quoteId='95950000-0000-4959-8959-000000000011';
const eventId='95950000-0000-4959-8959-000000000014';
const tripId='95950000-0000-4959-8959-000000000015';
const base='/v1/staging/rider/auto/bookings/'+bookingKey;
const receipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,bookingKey,cancellationKey:key,eventId,tripId,quoteId,
 tripState:'cancelled',tripRevision:2,financialState:'VOIDED_QA',
 reversalEntriesBalanced:true,pspCollected:false,pspRefunded:false,
 serverPersisted:true};
const headers={authorization:'Bearer '+'x'.repeat(40)};
const post=(body={requestKey:key,confirmed:true},h=headers)=>({
 method:'POST',path:base+'/cancel',headers:h,body});
const get=(body=undefined,h=headers)=>({
 method:'GET',path:base+'/cancellation',headers:h,body});
function app(extra={}){
 const calls=[];
 const gate=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:()=>1900000000000,
  verifyAccessToken:async()=>({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'}),
  authorizePassenger:async()=>true,
  allowRequest:x=>{calls.push(x);return true;},
  resolveVerifiedRoute:async()=>{},registerRoute:async()=>{},loadRoute:async()=>{},
  quoteRoute:async()=>{},loadQuote:async()=>{},bookQuote:async()=>{},
  reconcileBooking:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:actor,requestKey:bookingKey,quoteId,routeId:eventId,
   tripId,revision:1,serverPersisted:true,status:'ACCEPTED_QA'}),
  cancelBookedAuto:async()=>receipt,readCancellation:async()=>receipt,
  ...extra
 });
 return {gate,calls};
}
test('G95 OpenAPI explicitly QA-only, JWT and no arbitrary financial input',()=>{
 assert.equal(spec.info.version,'1.0.0-g95');
 const path='/v1/staging/rider/auto/bookings/{bookingKey}';
 const cancel=spec.paths[path+'/cancel']?.post;
 const recover=spec.paths[path+'/cancellation']?.get;
 assert.ok(cancel&&recover);
 assert.equal(cancel['x-qore-runtime-wired'],false);
 assert.equal(recover['x-qore-external-staging-certified'],false);
 assert.deepEqual(cancel.security,[{BearerAuth:[]}]);
 assert.deepEqual(recover.security,[{BearerAuth:[]}]);
 assert.equal(cancel.requestBody.content['application/json'].schema.$ref,
 '#/components/schemas/G95CancelRequest');
 assert.deepEqual(spec.components.schemas.G95CancelRequest.required,['requestKey','confirmed']);
 const dto=spec.components.schemas.G95PassengerAutoCancellation;
 assert.deepEqual(dto.required,Object.keys(dto.properties));
 assert.equal(dto.additionalProperties,false);
 assert.equal(dto.properties.pspCollected.const,false);
 assert.equal(dto.properties.pspRefunded.const,false);
 for(const k of ['driverId','amountGs','charge','refund','gps','photo','authorization'])
  assert.equal(dto.properties[k],undefined);
});
test('G95 one Passenger cancellation, repeated POST and lost ACK GET return same event',async()=>{
 const writes=[];
 const {gate,calls}=app({cancelBookedAuto:async args=>{writes.push(args);return receipt;}});
 assert.deepEqual(await gate(post()),{status:200,body:receipt});
 assert.deepEqual(await gate(post()),{status:200,body:receipt});
 assert.deepEqual(await gate(get()),{status:200,body:receipt});
 assert.deepEqual(writes,[{actorId:actor,requestKey:bookingKey,cancellationKey:key},
 {actorId:actor,requestKey:bookingKey,cancellationKey:key}]);
 assert.deepEqual(calls.map(c=>c.operation),['g95_cancel','g95_cancel','g95_cancel_receipt']);
});
test('G95 strict confirmation rejects client-defined price and cross-role use',async()=>{
 const {gate}=app();
 for(const b of [
  {requestKey:key,confirmed:false},{requestKey:key,confirmed:true,priceGs:0},
  {requestKey:key,confirmed:true,service:'MOTO_RIDE'},
  {requestKey:bookingKey,confirmed:'yes'},
  {requestKey:'malformed',confirmed:true},
  null,{}
 ])assert.equal((await gate(post(b))).status,400);
 assert.equal((await gate(get({priceGs:1}))).status,400);
 assert.equal((await gate(post(undefined,{}))).status,401);
 assert.equal((await app({authorizePassenger:async()=>false}).gate(post())).status,403);
 assert.equal((await app({allowRequest:()=>false}).gate(post())).status,429);
});
test('G95 SQL unavailable returns uncertain+reconcile, never fake success',async()=>{
 const noWrite=app({cancelBookedAuto:null});
 assert.equal((await noWrite.gate(post())).status,503);
 const down=app({cancelBookedAuto:async()=>{throw Error('PG_PASSWORD_LEAK');}});
 const r=await down.gate(post());
 assert.equal(r.status,503);
 assert.doesNotMatch(JSON.stringify(r),/PG_PASSWORD/);
 assert.deepEqual(await down.gate(get()),{status:200,body:receipt});
 assert.equal((await app({readCancellation:null}).gate(get())).status,503);
 assert.equal((await app({readCancellation:async()=>null}).gate(get())).status,404);
 assert.equal((await app({readCancellation:async()=>{throw Error('secret');}}).gate(get())).status,503);
});
test('G95 only accepts server receipt for original trip, actor, decision and void',async()=>{
 for(const patch of [
  {ownerId:stranger},{bookingKey:quoteId},{cancellationKey:quoteId},
  {eventId:'bad'},{tripId:'bad'}, {quoteId:'bad'},
  {tripState:'completed'},{tripRevision:1},
  {financialState:'PAID'},{financialState:'VOIDED_QA',reversalEntriesBalanced:false},
  {financialState:'NO_CAMPAIGN_QA'},{pspCollected:true},{pspRefunded:true},
  {serverPersisted:false},{commercialEnabled:true},{secret:'leak'}
 ]){
  const r=await app({cancelBookedAuto:async()=>({...receipt,...patch})}).gate(post());
  assert.equal(r.status,409,JSON.stringify(patch));
  assert.doesNotMatch(JSON.stringify(r),/95950000.*000000000015/);
 }
 const normal={...receipt,financialState:'NO_CAMPAIGN_QA',reversalEntriesBalanced:false};
 assert.deepEqual(await app({cancelBookedAuto:async()=>normal}).gate(post()),
  {status:200,body:normal});
});
test('G95 private SQL adapter passes only verified Passenger booking and decision key',async()=>{
 const calls=[];
 const r=createQoreG73AutoRepository({rpc:async(name,params)=>{
  calls.push({name,params});return {data:receipt,error:null};
 }});
 assert.deepEqual(await r.cancelBookedAuto({actorId:actor,requestKey:bookingKey,
  cancellationKey:key}),receipt);
 assert.deepEqual(calls[0],{name:'mobility_stage_g95_cancel_booked_auto_qa',
  params:{_passenger_id:actor,_booking_key:bookingKey,_cancellation_key:key}});
 assert.deepEqual(await r.cancellationReceipt({actorId:actor,requestKey:bookingKey}),receipt);
 assert.deepEqual(calls[1],{name:'mobility_stage_g95_cancel_receipt_qa',
  params:{_passenger_id:actor,_booking_key:bookingKey}});
 await assert.rejects(r.cancelBookedAuto({actorId:'spoofed',requestKey:bookingKey,cancellationKey:key}));
 await assert.rejects(r.cancellationReceipt({actorId:actor,requestKey:'invalid'}));
});
