import test from 'node:test';
import assert from 'node:assert/strict';
import {createG127GoogleCargoRoadResolver} from './g127-google-cargo-road-resolver.mjs';
import {createG125CargoPricingContext} from './g125-cargo-pricing-context.mjs';
const T=1790000000000;
const sender='12700000-0000-4127-8127-000000000001';
const delivery='12700000-0000-4127-8127-000000000002';
const coverageId='12700000-0000-4127-8127-000000000003';
const tollId='12700000-0000-4127-8127-000000000004';
const reservationId='12700000-0000-4127-8127-000000000005';
const place1='ChIJ_QORE_verified_place_id_000000000001';
const place2='ChIJ_QORE_verified_place_id_000000000002';
const token='MOCK_SERVER_KEY_NOT_REAL_RESTRICTED_12345';
const response=(payload={routes:[{distanceMeters:5700,duration:'735s'}]})=>({
 ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)
});
function make(vehicleKind,changes={}){
 let paid=0,coverageChecks=0,tollChecks=0,budgetChecks=0;
 const ctx={actorId:sender,deliveryId:delivery,vehicleKind,
  pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST'};
 const cov={source:'INDEPENDENT_COVERAGE_AUTHORITY',coverageVerified:true,
  ...ctx,evidenceId:coverageId,revision:1,zoneTag:vehicleKind+'_ASUNCION',
  originPlaceId:place1,destinationPlaceId:place2,verifiedAtMs:T-1000,
  ...changes.coverage};
 const toll={source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:true,
  coverageEvidenceId:coverageId,deliveryId:delivery,vehicleKind,
  originPlaceId:place1,destinationPlaceId:place2,
  distanceMeters:5700,durationSeconds:735,tollsPyg:0,
  evidenceId:tollId,verifiedAtMs:T-1000,...changes.toll};
 const req=[];
 const resolver=createG127GoogleCargoRoadResolver({
  billableProviderApproved:true,apiKey:token,now:()=>T,
  resolveCoveredCargoPlaces:async()=>{coverageChecks++;return cov;},
  reserveBillableBudget:async()=>{budgetChecks++;return {
   approved:true,durable:true,deliveryId:delivery,vehicleKind,
   coverageEvidenceId:coverageId,reservationId,
   ...changes.budget};},
  verifyCargoTolls:async()=>{tollChecks++;return toll;},
  request:async(url,opts)=>{paid++;req.push({url,opts});
   return changes.http??response(changes.payload);}
 });
 return {resolver,ctx,req,paid:()=>paid,coverage:()=>coverageChecks,
  tolls:()=>tollChecks,budget:()=>budgetChecks};
}
test('G127 does not permit billable route without separate approval and budgets',()=>{
 assert.throws(()=>createG127GoogleCargoRoadResolver({
  apiKey:token,resolveCoveredCargoPlaces:async()=>{},
  verifyCargoTolls:async()=>{},reserveBillableBudget:async()=>{}
 }),/not approved/);
 assert.throws(()=>createG127GoogleCargoRoadResolver({
  apiKey:token,billableProviderApproved:true,
  resolveCoveredCargoPlaces:async()=>{},verifyCargoTolls:async()=>{}
 }),/durable billing/);
});
test('G127 AUTO/MOTO share DRIVE road profile with distinct vehicle records',async()=>{
 for(const kind of ['AUTO','MOTO']){
  const x=make(kind);
  const proof=await x.resolver(x.ctx);
  assert.equal(proof.vehicleKind,kind);
  assert.equal(proof.zoneTag,kind+'_ASUNCION');
  assert.equal(proof.distanceMeters,5700);
  assert.equal(proof.durationSeconds,735);
  assert.equal(proof.tollsPyg,0);
  assert.equal(x.paid(),1);assert.equal(x.budget(),1);
  const api=x.req[0];assert.equal(api.url,
   'https://routes.googleapis.com/directions/v2:computeRoutes');
  assert.equal(api.opts.redirect,'error');
  assert.equal(api.opts.headers['X-Goog-FieldMask'],
   'routes.distanceMeters,routes.duration,fallbackInfo');
  const sent=JSON.parse(api.opts.body);
  assert.equal(sent.travelMode,'DRIVE');
  assert.equal(sent.routingPreference,'TRAFFIC_AWARE');
  assert.deepEqual(sent.origin,{placeId:place1});
  assert.deepEqual(sent.destination,{placeId:place2});
  assert.equal(api.opts.body.includes('PICKUP_EAST'),false);
  assert.equal(api.opts.body.includes(sender),false);
  const g125=createG125CargoPricingContext({
   enabled:true,now:()=>T,
   loadSenderDelivery:async()=>({
    id:delivery,sender_id:sender,requested_vehicle_kind:kind,
    pickup_tag:'PICKUP_EAST',delivery_tag:'DELIVERY_WEST',
    courier_id:null,status:'requested'
   }),
   resolveVerifiedCargoRoute:x.resolver,
   recordVerifiedRoute:async()=>({
    deliveryId:delivery,ownerId:sender,evidenceId:coverageId,
    vehicleKind:kind,zoneTag:kind+'_ASUNCION',
    distanceMeters:5700,durationSeconds:735,tollsPyg:0,
    routingVerified:true,serverPersisted:true,liveEnabled:false
   })
  });
  const result=await g125({
   actorId:sender,subjectId:delivery,
   fareMode:'DELIVERY',subjectKind:'DELIVERY'
  });
  assert.equal(result.zoneTag,kind+'_ASUNCION');
 }
});
test('G127 rejects invalid coverage BEFORE billing or Google calls',async()=>{
 for(const coverage of [{source:'CLIENT'}, {actorId:tollId},
  {vehicleKind:'AUTO'}, {zoneTag:'AUTO_ASUNCION'},
  {verifiedAtMs:T-61000}, {originPlaceId:place2},
  {coverageVerified:false}]){
  const x=make('MOTO',{coverage});
  await assert.rejects(x.resolver(x.ctx),/coverage/);
  assert.equal(x.paid(),0);assert.equal(x.budget(),0);
 }
});
test('G127 never calls Google when durable cost reservation is refused',async()=>{
 for(const budget of [{approved:false},{durable:false},{vehicleKind:'AUTO'}]){
  const x=make('MOTO',{budget});
  await assert.rejects(x.resolver(x.ctx),/budget/);
  assert.equal(x.paid(),0);assert.equal(x.tolls(),0);
 }
});
test('G127 refuses provider fallback, ambiguity and unverifiable tolls',async()=>{
 for(const payload of [
  {fallbackInfo:{reason:'FALLBACK'},routes:[{distanceMeters:5700,duration:'735s'}]},
  {routes:[{distanceMeters:5700,duration:'735s'},
   {distanceMeters:5800,duration:'750s'}]},
  {routes:[{distanceMeters:5700,duration:'735s',
   fallbackInfo:{routingMode:'FALLBACK'}}]},
  {routes:[{distanceMeters:0,duration:'735s'}]},
  {routes:[{distanceMeters:5700,duration:'bad'}]}
 ]){
  const x=make('MOTO',{payload});
  await assert.rejects(x.resolver(x.ctx));
  assert.equal(x.tolls(),0);assert.equal(x.paid(),1);
 }
 for(const toll of [{source:'UNKNOWN'}, {tollsVerified:false},
  {distanceMeters:1},{tollsPyg:-1},{vehicleKind:'AUTO'}]){
  const x=make('MOTO',{toll});await assert.rejects(x.resolver(x.ctx),/toll/);
  assert.equal(x.paid(),1);
 }
});
