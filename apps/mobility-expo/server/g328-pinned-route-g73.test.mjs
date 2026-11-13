import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
const actor='32800000-0000-4328-8328-000000000001';
const quoteRequestKey='32800000-0000-4328-8328-000000000002';
const evidenceId='32800000-0000-4328-8328-000000000003';
const routeId='32800000-0000-4328-8328-000000000004';
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
  registerRoute:async x=>{calls.register++;
   assert.equal(x.pinEvidenceId,evidenceId);return routeId;},
  loadRoute:async()=>admittedRoute,
  quoteRoute:async()=>{throw Error('not enabled')},
  loadQuote:async()=>null,bookQuote:async()=>{throw Error('not enabled')},
  reconcileBooking:async()=>null
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
 const wrongSql=fixture({loadRoute:async()=>({...admittedRoute,pinEvidenceId:routeId})});
 assert.equal((await wrongSql.app(call(body))).status,409);
 assert.equal(wrongSql.calls.register,1);
});
test('G328 cannot enable pin contract without real independent verifier',()=>{
 assert.throws(()=>createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',requirePinnedAutoRoute:true
 }),/required/);
});
