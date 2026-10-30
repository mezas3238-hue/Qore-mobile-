import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedManifest,digestManifest,verifyCheckpoint,G223_KINDS}
 from './g223-original-id-ledger-pg-ci.mjs';
function fake(){
 const services=G223_KINDS.map((kind,i)=>({
  serviceKind:kind,originalServiceId:'a2300000-0000-4230-8230-'+String(i+1).padStart(12,'0'),
  originalRequestKey:'b2300000-0000-4230-8230-'+String(i+1).padStart(12,'0'),
  status:kind==='COMMERCE'?'ready':'searching',sourcePersisted:true,
  clientToAdminSameOriginal:true,commercialEndToEndComplete:false,
  linkedCommerceDeliveryId:kind==='COMMERCE'?
   'c2300000-0000-4230-8230-000000000001':null
 }));
 const g=services.map(s=>({
  serviceKind:s.serviceKind,originalServiceId:s.originalServiceId,
  originalRequestKey:s.originalRequestKey,status:s.status,
  missingQaSteps:['driverAccepted'],qaJourneyClosed:false,
  commercialEndToEndCertified:false
 }));
 return {
  source:{mode:'STAGING_DEMO_ONLY',productionEnabled:false,
   originalPostgresAndAdminReceipts:5,services},
  readiness:{mode:'ISOLATED_DISPOSABLE_POSTGRES16',productionEnabled:false,
   sourceAndAdminOriginalCount:5,qaJourneysCompleted:0,qaJourneysStillOpen:5,
   externallyCertifiedJourneys:0,commercialLaunchAllowed:false,services:g}
 };
}
function checkpoint(){
 const f=fake();
 const items=validatedManifest(f.source,f.readiness);
 return {
  expected:items,
  dbRows:structuredClone(items),
  postReadbacks:items.map(s=>({
   serviceKind:s.serviceKind,serviceId:s.originalServiceId,
   bookingRequestKey:s.originalRequestKey,status:s.stateAtCapture,
   mode:'STAGING_DEMO_ONLY',productionEnabled:false,serverPersisted:true
  })),
  guard:{db:'qore_disposable_chain',app:'qore_ci_disposable_chain',
   g38Auto:true,g38Delivery:true,motoMunicipalAuthorized:0,
   eligibleZoneCount:0,syntheticActorsPersisted:0,
   serviceRoleCanWriteManifest:false}
 };
}
test('G223 validates exact five distinct original booking IDs and hashes',()=>{
 const f=fake();
 const manifest=validatedManifest(f.source,f.readiness);
 assert.equal(manifest.length,5);
 assert.match(digestManifest(manifest),/^[0-9a-f]{64}$/);
 assert.equal(digestManifest(manifest),digestManifest(manifest));
});
test('G223 independently verifies committed identities after rollback',()=>{
 assert.equal(verifyCheckpoint(checkpoint()),true);
});
test('G223 rejects same-ID substitution, repeated request, and counterfeit completion',()=>{
 const scenarios=[
  f=>{f.readiness.services[0].originalServiceId='ffffffff-ffff-ffff-ffff-ffffffffffff';},
  f=>{f.source.services[1].originalRequestKey=f.source.services[0].originalRequestKey;
      f.readiness.services[1].originalRequestKey=f.source.services[1].originalRequestKey;},
  f=>{f.source.services[0].commercialEndToEndComplete=true;},
  f=>{f.readiness.qaJourneysCompleted=5;f.readiness.qaJourneysStillOpen=0;},
  f=>{f.source.services[4].linkedCommerceDeliveryId=null;}
 ];
 for(const mutate of scenarios){
  const f=fake();mutate(f);
  assert.throws(()=>validatedManifest(f.source,f.readiness));
 }
});
test('G223 fails closed for mutated DB IDs, false Admin, relaxed legal gates',()=>{
 for(const change of [
  p=>p.dbRows[0].originalServiceId='ffffffff-ffff-ffff-ffff-ffffffffffff',
  p=>p.postReadbacks[2].bookingRequestKey='ffffffff-ffff-ffff-ffff-ffffffffffff',
  p=>p.postReadbacks[4].productionEnabled=true,
  p=>p.guard.g38Auto=false,
  p=>p.guard.g38Delivery=false,
  p=>p.guard.motoMunicipalAuthorized=1,
  p=>p.guard.eligibleZoneCount=1,
  p=>p.guard.syntheticActorsPersisted=1,
  p=>p.guard.serviceRoleCanWriteManifest=true
 ]){
  const p=checkpoint();change(p);
  assert.throws(()=>verifyCheckpoint(p));
 }
});
