import test from 'node:test';
import assert from 'node:assert/strict';
import {createG134GeoapifyAutoRouteResolver} from './g134-geoapify-auto-route-resolver.mjs';
const actor='13400000-0000-4134-8134-000000000001';
const quote='13400000-0000-4134-8134-000000000002';
const evidence='13400000-0000-4134-8134-000000000003';
const proof='13400000-0000-4134-8134-000000000004';
const reservation='13400000-0000-4134-8134-000000000005';
const params={actorId:actor,quoteRequestKey:quote,
 origin:'Centro, Asunción',destination:'Aeropuerto, Asunción',
 service:'economico'};
const at=1790000000000;
function setup(overrides={}){
 let calls=0,quotas=0;
 const covered={
  source:'INDEPENDENT_COVERAGE_AUTHORITY',coverageVerified:true,
  actorId:actor,quoteRequestKey:quote,originAddress:params.origin,
  destinationAddress:params.destination,service:'economico',
  evidenceId:evidence,revision:1,zoneTag:'AUTO_ASUNCION',
  originCoordinates:{lat:-25.2773434,lon:-57.6371671},
  destinationCoordinates:{lat:-25.2828767,lon:-57.5674503},
  verifiedAtMs:at-1000,...overrides.coverage
 };
 const output={results:[{distance:8253,time:808.305,
  distance_units:'meters',toll:false}]};
 const resolver=createG134GeoapifyAutoRouteResolver({
  freePlanApproved:true,apiKey:'QA_NOT_ACTUAL_GEOAPIFY_FREE_TOKEN_0123456789',
  tagSecret:'G134_SERVER_PRIVATE_HASH_KEY_FOR_QA_ONLY_0123456789',
  now:()=>at,
  resolveCoveredAutoCoordinates:async()=>covered,
  verifyAutoTolls:async input=>({
   source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:true,
   quoteRequestKey:quote,actorId:actor,evidenceId:proof,
   distanceMeters:input.distanceMeters,
   durationSeconds:input.durationSeconds,tollsPyg:0,verifiedAtMs:at
  }),
  reserveFreeQuota:async input=>{quotas++;
   assert.equal(input.serviceKind,'AUTO_RIDE');
   assert.equal(input.quoteRequestKey,quote);
   return {approved:true,durable:true,reservationId:reservation,
    deliveryId:quote,vehicleKind:'AUTO',coverageEvidenceId:evidence};
  },
  request:async(url,opts)=>{calls++;
   assert.equal(new URL(url).origin,'https://api.geoapify.com');
   assert.equal(opts.method,'GET');
   return {ok:true,status:200,redirected:false,
    headers:{get:x=>x==='content-type'?'application/json':null},
    text:async()=>JSON.stringify(output)};
  }
 });
 return {resolver,counters:()=>({calls,quotas})};
}
test('G134 AUTO real G128 adapter resolves private G73 route with quota/coverage/tolls',async()=>{
 const x=setup(),r=await x.resolver(params);
 assert.deepEqual(x.counters(),{calls:1,quotas:1});
 assert.equal(r.routingVerified,true);
 assert.equal(r.coverageVerified,true);
 assert.equal(r.distanceMeters,8253);
 assert.equal(r.durationSeconds,809);
 assert.equal(r.tollsPyg,0);
 assert.equal(r.zoneTag,'AUTO_ASUNCION');
 assert.match(r.originTag,/^LOC_[A-P]{32}$/);
 assert.notEqual(r.originTag,r.destinationTag);
 assert.equal(JSON.stringify(r).includes('Asunción'),false);
});
test('G134 unauthorized coverage prevents a single provider/quota call',async()=>{
 for(const bad of [{source:'CLIENT'},{actorId:evidence},
  {originAddress:'spoofed'},{quoteRequestKey:evidence},
  {coverageVerified:false}]){
  const x=setup({coverage:bad});
  await assert.rejects(x.resolver(params),/coverage|addresses/);
  assert.deepEqual(x.counters(),{calls:0,quotas:0});
 }
});
test('G134 mismatched identities and repeated addresses are rejected',async()=>{
 const x=setup();
 for(const bad of [{quoteRequestKey:'bad'},
  {origin:'Centro, Asunción',destination:'Centro, Asunción'},
  {service:'test'},{actorId:evidence}]){
  if(bad.actorId===evidence){
   // A different authenticated identity cannot re-use the coverage witness.
   await assert.rejects(x.resolver({...params,...bad}),/addresses/);
  }else await assert.rejects(x.resolver({...params,...bad}),/invalid/);
 }
});
test('G134 refuses enabling without independent quota/coverage and Free approval',()=>{
 assert.throws(()=>createG134GeoapifyAutoRouteResolver({
  freePlanApproved:false}),/not approved/);
 assert.throws(()=>createG134GeoapifyAutoRouteResolver({
  freePlanApproved:true,tagSecret:'short'}),/required/);
});
