import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreFinanceGateway} from './g7-finance-gateway.mjs';

const ref='staging1234567890abcd';
const passenger='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const subject='33333333-3333-4333-8333-333333333333';
const requestKey='44444444-4444-4444-8444-444444444444';
const quoteId='55555555-5555-4555-8555-555555555555';
const paymentId='66666666-6666-4666-8666-666666666666';
const eventId='77777777-7777-4777-8777-777777777777';
const bearer=id=>'synthetic_finance_'+id.replaceAll('-','')+'_bearer';
const headers=id=>({authorization:'Bearer '+bearer(id)});
const quote={requestKey,fareMode:'MERCHANT_DELIVERY',subjectKind:'MERCHANT_ORDER',
 subjectId:subject};
function fixture(){
 const calls=[];
 const gateway=createQoreFinanceGateway({
  projectRef:ref,now:()=>Date.parse('2026-10-23T03:15:00Z'),
  verifyAccessToken:async token=>{
   const id=[passenger,outsider].find(value=>bearer(value)===token);
   if(!id)throw Error('unauthorized');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'};
  },
  authorizePassenger:async id=>id===passenger,
  allowRequest:()=>true,
  loadPricingContext:async input=>{calls.push({operation:'pricing',input});return {
   zoneTag:'ASUNCION_FIXTURE',distanceMeters:5000,durationSeconds:900,
   tollsPyg:2000,trafficAware:true,fallbackUsed:false,
  };},
  quoteFare:async input=>{calls.push({operation:'quote',input});return {ok:true,
   liveEnabled:false,quote:{id:quoteId,mode:input.fareMode,
    subjectKind:input.subjectKind,subjectId:input.subjectId,totalPyg:15000,
    ruleVersion:'PY_ASU_V1',expiresAt:'2026-10-23T03:20:00Z'}};},
  authorizePayment:async input=>{calls.push({operation:'authorize',input});return {
   ok:true,liveEnabled:false,paymentId};},
  transitionPayment:async input=>{calls.push({operation:'transition',input});return {
   ok:true,liveEnabled:false,eventId};},
  loadPayment:async input=>{calls.push({operation:'status',input});return {ok:true,
   liveEnabled:false,payment:{id:paymentId,status:'authorized',amountPyg:15000}};},
 });
 return {gateway,calls};
}

test('quote accepts only subject reference and derives route price server-side',async()=>{
 const f=fixture();
 const out=await f.gateway({method:'POST',path:'/v1/staging/fares/quote',
  headers:headers(passenger),body:quote});
 assert.equal(out.status,201);
 assert.equal(out.body.serverPriced,true);
 assert.equal(out.body.livePaymentsEnabled,false);
 assert.deepEqual(f.calls[0],{operation:'pricing',input:{actorId:passenger,
  fareMode:'MERCHANT_DELIVERY',subjectKind:'MERCHANT_ORDER',subjectId:subject}});
 assert.equal(f.calls[1].input.distanceMeters,5000);
 for(const forged of [{...quote,zoneTag:'OTHER'},{...quote,totalPyg:1},
  {...quote,distanceMeters:1},{...quote,fareMode:'AUTO'}])
  assert.equal((await f.gateway({method:'POST',path:'/v1/staging/fares/quote',
   headers:headers(passenger),body:forged})).status,400);
});

test('payment API permits simulated methods and authenticated customer only',async()=>{
 const f=fixture();
 const authorize=await f.gateway({method:'POST',path:'/v1/staging/payments/authorize',
  headers:headers(passenger),body:{requestKey,quoteId,method:'SIMULATED_CARD'}});
 assert.equal(authorize.status,201);
 assert.equal(authorize.body.paymentId,paymentId);
 assert.equal(authorize.body.status,'authorized');
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/payments/authorize',
  headers:headers(passenger),body:{requestKey,quoteId,method:'CARD'}})).status,400);
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/payments/authorize',
  headers:headers(outsider),body:{requestKey,quoteId,method:'SIMULATED_CASH'}})).status,403);
});

test('capture/refund/cancel and status never accept amount or actor overrides',async()=>{
 const f=fixture();
 const path=`/v1/staging/payments/${paymentId}/transition`;
 const transitioned=await f.gateway({method:'POST',path,headers:headers(passenger),
  body:{event:'capture',eventKey:requestKey}});
 assert.equal(transitioned.status,200);
 assert.equal(f.calls.at(-1).input.actorId,passenger);
 assert.equal(f.calls.at(-1).input.paymentId,paymentId);
 assert.equal((await f.gateway({method:'POST',path,headers:headers(passenger),
  body:{event:'capture',eventKey:requestKey,amountPyg:1}})).status,400);
 const status=await f.gateway({method:'GET',
  path:`/v1/staging/payments/${paymentId}/status`,headers:headers(passenger)});
 assert.equal(status.status,200);
 assert.equal(status.body.payment.id,paymentId);
});

test('Auth, trusted route evidence, rate limit and live receipts fail closed',async()=>{
 const f=fixture();
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/fares/quote',
  headers:{},body:quote})).status,401);
 const common={projectRef:ref,verifyAccessToken:async()=>({id:passenger,
  is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'}),
  authorizePassenger:async()=>true,quoteFare:async()=>({ok:true,liveEnabled:true,
   quote:{id:quoteId,mode:'MERCHANT_DELIVERY',subjectId:subject}}),
  authorizePayment:async()=>{},transitionPayment:async()=>{},loadPayment:async()=>{}};
 const unverified=createQoreFinanceGateway({...common,allowRequest:()=>true,
  loadPricingContext:async()=>({zoneTag:'ASUNCION_FIXTURE',distanceMeters:1,
   durationSeconds:1,tollsPyg:0,trafficAware:false,fallbackUsed:false})});
 assert.equal((await unverified({method:'POST',path:'/v1/staging/fares/quote',
  headers:headers(passenger),body:quote})).status,409);
 const limited=createQoreFinanceGateway({...common,allowRequest:()=>false,
  loadPricingContext:async()=>({})});
 assert.equal((await limited({method:'POST',path:'/v1/staging/fares/quote',
  headers:headers(passenger),body:quote})).status,429);
});

test('G24 server-owned Cliente quote DTO: verified price, owner, TTL and no motorcycle passenger quote',async()=>{
 const {gateway}=fixture();
 const result=await gateway({method:'POST',path:'/v1/staging/fares/quote',
  headers:headers(passenger),body:quote});
 assert.equal(result.status,201);
 assert.equal(result.body.ownerId,passenger);
 assert.equal(result.body.quoteId,quoteId);
 assert.equal(result.body.amountGs,15000);
 assert.equal(result.body.fareMode,'MERCHANT_DELIVERY');
 assert.equal(result.body.subjectKind,'MERCHANT_ORDER');
 assert.equal(result.body.subjectId,subject);
 assert.equal(result.body.expiresAt,Date.parse('2026-10-23T03:20:00Z'));
 assert.equal(result.body.fareVersion,'PY_ASU_V1');
 assert.equal(result.body.routingVerified,true);
 assert.equal(result.body.livePaymentsEnabled,false);
 assert.equal((await gateway({method:'POST',path:'/v1/staging/fares/quote',
  headers:headers(passenger),body:{...quote,fareMode:'MOTO',subjectKind:'RIDE'}})).status,400);
});

test('G24 rejects quote receipts without provable server amount, version, ownership and expiry',async()=>{
 const clean={id:quoteId,mode:'MERCHANT_DELIVERY',subjectId:subject,
  subjectKind:'MERCHANT_ORDER',totalPyg:15000,
  ruleVersion:'PY_ASU_V1',expiresAt:'2026-10-23T03:20:00Z'};
 const common={projectRef:ref,now:()=>Date.parse('2026-10-23T03:15:00Z'),
  verifyAccessToken:async()=>({id:passenger,is_anonymous:false,
   email_confirmed_at:'2026-10-22T12:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:()=>true,
  loadPricingContext:async()=>({zoneTag:'ASUNCION_FIXTURE',distanceMeters:5000,
   durationSeconds:900,tollsPyg:2000,trafficAware:true,fallbackUsed:false}),
  authorizePayment:async()=>{},transitionPayment:async()=>{},loadPayment:async()=>{}};
 for(const forged of [
  {...clean,totalPyg:0},{...clean,totalPyg:1.5},
  {...clean,subjectId:outsider},{...clean,subjectKind:'RIDE'},
  {...clean,ruleVersion:''},{...clean,ruleVersion:'BAD RULE'},
  {...clean,expiresAt:'2026-10-23T03:14:00Z'},
  {...clean,expiresAt:'2026-10-23T05:15:00Z'}
 ]){
  const gateway=createQoreFinanceGateway({...common,
   quoteFare:async()=>({ok:true,liveEnabled:false,quote:forged})});
  const result=await gateway({method:'POST',path:'/v1/staging/fares/quote',
   headers:headers(passenger),body:quote});
  assert.equal(result.status,409,JSON.stringify(forged));
  assert.doesNotMatch(JSON.stringify(result),/PY_ASU_V1|15000/);
 }
});
