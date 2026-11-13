import test from 'node:test';
import assert from 'node:assert/strict';
import {createG134GeoapifyAutoRouteResolver}
 from './g134-geoapify-auto-route-resolver.mjs';
const at=1794500000000;
const actorId='32800000-0000-4328-8328-000000000001';
const quoteRequestKey='32800000-0000-4328-8328-000000000002';
const evidenceId='32800000-0000-4328-8328-000000000003';
const coverageEvidenceId='32800000-0000-4328-8328-000000000005';
const params={actorId,quoteRequestKey,
 origin:'Hernandarias, Alto Paraná',destination:'Ciudad del Este, Alto Paraná',
 service:'economico'};
const verifiedPinEvidence={source:'INDEPENDENT_PIN_AUTHORITY',
 actorId,quoteRequestKey,origin:params.origin,destination:params.destination,
 service:params.service,evidenceId,revision:2,verifiedAtMs:at-1000,
 pickupPoint:{latitude:-25.4061,longitude:-54.6302},
 dropoffPoint:{latitude:-25.5092,longitude:-54.6115}};
function fixture(override={}){
 const calls={coverage:0,provider:0,quota:0};
 const coverage={
  source:'INDEPENDENT_COVERAGE_AUTHORITY',
  coverageVerified:true,actorId,quoteRequestKey,
  originAddress:params.origin,destinationAddress:params.destination,
  service:'economico',evidenceId:coverageEvidenceId,
  revision:1,zoneTag:'ALTO_PARANA',
  pinEvidenceId:evidenceId,
  originCoordinates:{lat:-25.4061,lon:-54.6302},
  destinationCoordinates:{lat:-25.5092,lon:-54.6115},
  verifiedAtMs:at-1000,...override.coverage
 };
 const f=createG134GeoapifyAutoRouteResolver({
  freePlanApproved:true,apiKey:'QA_G328_FAKE_GEOAPIFY_NOT_A_REAL_CREDENTIAL',
  tagSecret:'G328_PRIVATE_TEST_TAG_SECRET_OVER_32_CHARACTERS',
  now:()=>at,request:async()=>{
   calls.provider++;
   return {ok:true,status:200,redirected:false,
    headers:{get:x=>x==='content-type'?'application/json':null},
    text:async()=>JSON.stringify({results:[{
     distance:5000,time:620,toll:false,distance_units:'meters'}]})};
  },
  resolveCoveredAutoCoordinates:async scope=>{
   calls.coverage++;
   assert.equal(scope.verifiedPinEvidence.evidenceId,evidenceId);
   return coverage;
  },
  verifyAutoTolls:async scope=>({
   source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:true,
   quoteRequestKey,actorId,evidenceId:'32800000-0000-4328-8328-000000000006',
   distanceMeters:scope.distanceMeters,durationSeconds:scope.durationSeconds,
   tollsPyg:0,verifiedAtMs:at
  }),
  reserveFreeQuota:async()=>{calls.quota++;
   return {approved:true,durable:true,
    reservationId:'32800000-0000-4328-8328-000000000007',
    deliveryId:quoteRequestKey,vehicleKind:'AUTO',
    coverageEvidenceId};
  }
 });
 return {resolve:f,calls};
}
test('G328 G134 route binds independent covered road to exact verified pins',async()=>{
 const f=fixture();
 const r=await f.resolve({...params,verifiedPinEvidence});
 assert.equal(r.pinBound,true);
 assert.equal(r.pinEvidenceId,evidenceId);
 assert.equal(r.routingVerified,true);
 assert.equal(r.coverageVerified,true);
 assert.equal(r.distanceMeters,5000);
 assert.deepEqual(f.calls,{coverage:1,provider:1,quota:1});
});
test('G328 cannot call Geoapify when independent coverage changes pins or evidence',async()=>{
 for(const coverage of [
  {pinEvidenceId:'32800000-0000-4328-8328-000000000009'},
  {originCoordinates:{lat:-25.4088,lon:-54.6302}},
  {destinationCoordinates:{lat:-25.5100,lon:-54.6115}},
  {coverageVerified:false}
 ]){
  const f=fixture({coverage});
  await assert.rejects(f.resolve({...params,verifiedPinEvidence}),/coverage|addresses/i);
  assert.equal(f.calls.provider,0);
  assert.equal(f.calls.quota,0);
 }
});
test('G328 forged pin provenance rejected before coverage and network',async()=>{
 const f=fixture();
 await assert.rejects(f.resolve({...params,verifiedPinEvidence:{
  ...verifiedPinEvidence,actorId:'32800000-0000-4328-8328-000000000008'
 }}),/pin evidence/);
 assert.deepEqual(f.calls,{coverage:0,provider:0,quota:0});
});
