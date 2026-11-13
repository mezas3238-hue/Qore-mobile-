import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
const actor='32800000-0000-4328-8328-000000000001';
const quoteRequestKey='32800000-0000-4328-8328-000000000002';
const evidenceId='32800000-0000-4328-8328-000000000003';
const routeId='32800000-0000-4328-8328-000000000004';
const quoteId='32800000-0000-4328-8328-000000000005';
const priceRequestKey='32800000-0000-4328-8328-000000000006';
const bookingKey='32800000-0000-4328-8328-000000000007';
const tripId='32800000-0000-4328-8328-000000000008';
const time=1794500000000;
const body={quoteRequestKey,origin:'Hernandarias, Alto Paraná',
 destination:'Ciudad del Este, Alto Paraná',service:'economico',
 pickupPoint:{latitude:-25.4061,longitude:-54.6302},
 dropoffPoint:{latitude:-25.5092,longitude:-54.6115}};
const source=(p={})=>({source:'INDEPENDENT_PIN_AUTHORITY',
 serverVerified:true,coverageVerified:true,actorId:actor,
 quoteRequestKey,origin:body.origin,destination:body.destination,
 service:body.service,pickupPoint:body.pickupPoint,
 dropoffPoint:body.dropoffPoint,evidenceId,revision:1,
 verifiedAtMs:time-1000,...p});
const call=x=>({method:'POST',path:'/v1/staging/rider/auto/routes',
 headers:{authorization:'Bearer '+ 'x'.repeat(40)},body:x});
const quoteReceipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,routeId,quoteId,quoteRequestKey:priceRequestKey,
 fareMode:'AUTO',service:'economico',currency:'PYG',amountGs:18000,
 fareVersion:'g328-qa-v1',expiresAt:time+60000,serverPriced:true,
 routingVerified:true,status:'QUOTED_QA'};
const bookReceipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,requestKey:bookingKey,quoteId,routeId,tripId,revision:1,
 serverPersisted:true,status:'ACCEPTED_QA'};
const admittedRoute={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,routeId,requestKey:quoteRequestKey,service:'economico',
 routingVerified:true,expiresAt:time+60000,pinBound:true,pinEvidenceId:evidenceId};
function fixture(override={}){
 const calls={provider:0,route:0,register:0};
 const base={
  projectRef:'staging1234567890abcd',now:()=>time,
  verifyAccessToken:async()=>({id:actor,is_anonymous:false,
   email_confirmed_at:'2026-10-24T00:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:()=>true,
  requirePinnedAutoRoute:true,
  verifyIndependentPins:async()=>{calls.provider++;return source();},
  resolveVerifiedRoute:async x=>{calls.route++;
   assert.equal(x.verifiedPinEvidence.actorId,actor);
   return {routingVerified:true,coverageVerified:true,trafficAware:true,
    fallbackUsed:false,originTag:'HERNANDARIAS',destinationTag:'CIUDAD_DEL_ESTE',
    zoneTag:'ALTO_PARANA',distanceMeters:3000,durationSeconds:320,
    tollsPyg:0,pinBound:true,pinEvidenceId:evidenceId};
  },
  registerRoute:async()=>{throw Error('legacy SQL must not be called');},
  loadRoute:async()=>{throw Error('legacy SQL must not be called');},
  registerPinnedRoute:async x=>{calls.register++;
   assert.equal(x.pinEvidenceId,evidenceId);return routeId;},
  loadPinnedRoute:async()=>admittedRoute,
  quoteRoute:async()=>quoteId,
  loadQuote:async()=>quoteReceipt,bookQuote:async()=>tripId,
  reconcileBooking:async()=>bookReceipt
 };
 return {app:createQoreG73AutoGateway({...base,...override}),calls};
}
test('G328 verifies exact pin evidence BEFORE provider routing and persisted G73 route',async()=>{
 const f=fixture();
 const result=await f.app(call(body));
 assert.equal(result.status,200);
 assert.equal(result.body.source,'SERVER_VERIFIED_ROUTE');
 assert.equal(result.body.routeId,routeId);
 assert.equal(Object.hasOwn(result.body,'pickupPoint'),false);
 assert.deepEqual(f.calls,{provider:1,route:1,register:1});
});
test('G328 rejects label-only and suspicious map payloads before all authority calls',async()=>{
 const f=fixture();
 const {pickupPoint,dropoffPoint,...labelOnly}=body;
 assert.equal((await f.app(call(labelOnly))).status,400);
 assert.equal((await f.app(call({...body,priceGs:99}))).status,400);
 assert.equal((await f.app(call({...body,dropoffPoint:pickupPoint}))).status,400);
 assert.deepEqual(f.calls,{provider:0,route:0,register:0});
});
test('G328 refuses provider-missing, mismatched coverage, wrong resolver or SQL receipt',async()=>{
 const offline=fixture({verifyIndependentPins:async()=>{throw Error('offline');}});
 assert.equal((await offline.app(call(body))).status,409);
 assert.equal(offline.calls.route,0);
 const falseProof=fixture({verifyIndependentPins:async()=>source({actorId:routeId})});
 assert.equal((await falseProof.app(call(body))).status,409);
 assert.equal(falseProof.calls.route,0);
 const wrongRoute=fixture({resolveVerifiedRoute:async()=>({
  routingVerified:true,coverageVerified:true,trafficAware:true,fallbackUsed:false,
  originTag:'HERNANDARIAS',destinationTag:'CIUDAD_DEL_ESTE',zoneTag:'ALTO_PARANA',
  distanceMeters:3000,durationSeconds:320,tollsPyg:0
 })});
 assert.equal((await wrongRoute.app(call(body))).status,409);
 assert.equal(wrongRoute.calls.register,0);
 const wrongSql=fixture({loadPinnedRoute:async()=>({...admittedRoute,pinEvidenceId:routeId})});
 assert.equal((await wrongSql.app(call(body))).status,409);
 assert.equal(wrongSql.calls.register,1);
});
test('G328 cannot enable pin contract without independent verifier and dedicated SQL writer',()=>{
 const f=fixture();
 assert.equal(typeof f.app,'function');
 assert.throws(()=>fixture({registerPinnedRoute:null}),/required/);
 assert.throws(()=>fixture({loadPinnedRoute:null}),/required/);
 assert.throws(()=>fixture({verifyIndependentPins:null}),/required/);
});

test('G328 forbids old unpinned route at quote and unbound quote at booking',async()=>{
 let priced=0,booked=0;
 const blocked=fixture({
  loadPinnedRoute:async()=>null,
  quoteRoute:async()=>{priced++;return quoteId;},
  bookQuote:async()=>{booked++;return tripId;}
 });
 const quote=await blocked.app(call({
  requestKey:priceRequestKey,routeId
 }));
 // Override endpoint to the dedicated quote path.
 const quoteReq={...call({requestKey:priceRequestKey,routeId}),
  path:'/v1/staging/rider/auto/prequote'};
 assert.equal(quote.status,400);
 assert.equal((await blocked.app(quoteReq)).status,409);
 const bookReq={...call({requestKey:bookingKey,quoteId,accepted:true}),
  path:'/v1/staging/rider/auto/book'};
 assert.equal((await blocked.app(bookReq)).status,409);
 assert.equal(priced,0);assert.equal(booked,0);
});
test('G328 allows QA quote and booking only with independently linked pin readback',async()=>{
 const f=fixture();
 const quoteReq={...call({requestKey:priceRequestKey,routeId}),
  path:'/v1/staging/rider/auto/prequote'};
 const quote=await f.app(quoteReq);
 assert.equal(quote.status,200);
 assert.equal(quote.body.quoteId,quoteId);
 const bookReq={...call({requestKey:bookingKey,quoteId,accepted:true}),
  path:'/v1/staging/rider/auto/book'};
 const booked=await f.app(bookReq);
 assert.equal(booked.status,201);
 assert.equal(booked.body.tripId,tripId);
});
test('G328 denies mismatched routeId on a signed quote without booking',async()=>{
 let booked=0;
 const f=fixture({
  loadQuote:async()=>({...quoteReceipt,routeId:bookingKey}),
  bookQuote:async()=>{booked++;return tripId;}
 });
 const r=await f.app({...call({requestKey:bookingKey,quoteId,accepted:true}),
  path:'/v1/staging/rider/auto/book'});
 assert.equal(r.status,409);
 assert.equal(booked,0);
});

test('G335 refuses a signed price for a different class than the verified pins',async()=>{
 let quotes=0;
 const f=fixture({
  quoteRoute:async()=>{quotes++;return quoteId;},
  loadQuote:async()=>({...quoteReceipt,service:'xl'})
 });
 const req={...call({requestKey:priceRequestKey,routeId}),
  path:'/v1/staging/rider/auto/prequote'};
 const response=await f.app(req);
 assert.equal(response.status,409);
 assert.match(response.body.error,/service mismatch/);
 assert.equal(quotes,1);
 // A rejected quote response never becomes passenger booking authority.
});

test('G335 blocks booking even if the signed quote and pinned route have valid IDs',async()=>{
 let bookings=0;
 const f=fixture({
  loadQuote:async()=>({...quoteReceipt,service:'confort'}),
  bookQuote:async()=>{bookings++;return tripId;}
 });
 const req={...call({requestKey:bookingKey,quoteId,accepted:true}),
  path:'/v1/staging/rider/auto/book'};
 const response=await f.app(req);
 assert.equal(response.status,409);
 assert.match(response.body.error,/service mismatch/);
 assert.equal(bookings,0);
});

test('G335 blocks an unrelated pinned service even with an otherwise valid quote',async()=>{
 let quotes=0,bookings=0;
 const f=fixture({
  loadPinnedRoute:async()=>({...admittedRoute,service:'xl'}),
  quoteRoute:async()=>{quotes++;return quoteId;},
  bookQuote:async()=>{bookings++;return tripId;}
 });
 const quoteReq={...call({requestKey:priceRequestKey,routeId}),
  path:'/v1/staging/rider/auto/prequote'};
 const bookReq={...call({requestKey:bookingKey,quoteId,accepted:true}),
  path:'/v1/staging/rider/auto/book'};
 assert.equal((await f.app(quoteReq)).status,409);
 assert.equal((await f.app(bookReq)).status,409);
 assert.equal(quotes,1);
 assert.equal(bookings,0);
});
