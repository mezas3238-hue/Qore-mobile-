import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const basic={riderHandler:async()=>({status:503,body:{error:'disabled'}}),
 offerHandler:async()=>({status:503,body:{error:'disabled'}}),
 tripCommandHandler:async()=>({status:503,body:{error:'disabled'}}),
 deliveryHandler:async()=>({status:503,body:{error:'disabled'}}),
 merchantHandler:async()=>({status:503,body:{error:'disabled'}}),
 financeHandler:async()=>({status:503,body:{error:'disabled'}}),
 safetyHandler:async()=>({status:503,body:{error:'disabled'}}),
 merchantManagementHandler:async()=>({status:503,body:{error:'disabled'}}),
 deliveryOfferHandler:async()=>({status:503,body:{error:'disabled'}})};
const tariff='/v1/staging/owner/auto-fares/ASUNCION_QA';
const vehicle='/v1/staging/vehicle-applications';
test('G284 separate fare flag defaults OFF and requires independently approved G260 AAL2',async()=>{
 const entry=await read('./run-g4-railway-staging.mjs');
 const runtime=await read('./g4-staging-runtime.mjs');
 assert.match(entry,/QORE_G268_OWNER_FARE_APPROVED/);
 assert.match(entry,/g268OwnerFareApproved=env.QORE_G268_OWNER_FARE_APPROVED==='true'/);
 assert.match(entry,/if\(g268OwnerFareApproved&&!g260AdminAal2Approved\)/);
 assert.match(entry,/g268OwnerFareApproved\}\=assertRailwayEnvironment/);
 assert.match(entry,/g268OwnerFareApproved,\n autoDispatchRetryQa/);
 assert.match(entry,/projectRef:process\.env\.QORE_STAGING_PROJECT_REF/);
 assert.match(runtime,/g268OwnerFareApproved=false/);
 assert.match(runtime,/g268OwnerFareApproved&&!g260AdminAal2Approved/);
 assert.match(runtime,/!g268OwnerFareApproved\|\|verifiedAdminTrust===null\?null:createG268OwnerAutoFareGateway/);
 assert.match(runtime,/admin\.rpc\('mobility_stage_g265_publish_auto_fare'/);
});
test('G284 Owner SQL publication uses verified session and original G27/AAL2 only',async()=>{
 const runtime=await read('./g4-staging-runtime.mjs');
 assert.match(runtime,/verifyAccessToken:verifiedAdminSession/);
 assert.match(runtime,/loadExclusiveBackofficeRole:adminRoleFromSql/);
 assert.match(runtime,/verifyBackofficeMfa:p=>resolvedAdminF1Trust.verifyBackofficeMfa\(p\)/);
 assert.match(runtime,/mobility_stage_g27_backoffice_role_of/);
 assert.match(runtime,/ownerAutoFareHandler:guard\(ownerAutoFare\)/);
});
test('G284 preserves G282 and G272 Railway fixes while integrating Owner fares',async()=>{
 const entry=await read('./run-g4-railway-staging.mjs');
 const runtime=await read('./g4-staging-runtime.mjs');
 const transport=await read('./g4-loopback-http-transport.mjs');
 assert.match(runtime,/g282VehicleDraftApproved=false/);
 assert.match(runtime,/g282VehicleDraftHandler:guard\(g282VehicleDraft\)/);
 assert.match(runtime,/select\('\*',\{head:true\}\)\.limit\(0\)/);
 assert.match(runtime,/createQoreG260AdminAal2Trust/);
 assert.match(transport,/ownerAutoFarePost\?\(ownerAutoFareHandler/);
 assert.match(transport,/g282VehicleDraftPost\|\|ownerCommissionPost\|\|ownerAutoFarePost/);
 assert.match(entry,/QORE_G282_VEHICLE_DRAFT_APPROVED/);
 assert.match(entry,/LIVE_TRIPS_ENABLED/);
 assert.match(entry,/QORE_RAILWAY_NO_COMMERCIAL_TRIPS/);
});
test('G284 HTTP Owner tariffs fail closed independently of Driver vehicle draft',async()=>{
 let calls=0,vehicles=0;
 const server=createQoreRadarLoopbackTransport({...basic,
  g282VehicleDraftHandler:async()=>{vehicles++;return {status:202,body:{status:'pending',commercialEnabled:false}};}
 });
 const origin=await listenQoreRadarLoopback(server);
 try{
  const post=await fetch(origin+tariff,{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({basePyg:8500})});
  assert.equal(post.status,503);
  assert.equal((await post.json()).error,'G268 Owner AUTO tariff disabled');
  const draft=await fetch(origin+vehicle,{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({requestKey:'00000000-0000-4000-8000-000000000010'})});
  assert.equal(draft.status,202);
  assert.equal(vehicles,1);
  assert.equal(calls,0);
  for(const url of [tariff+'?live=true',tariff.toLowerCase()]){
   const denied=await fetch(origin+url,{method:'POST',
    headers:{'content-type':'application/json'},body:'{}'});
   assert.equal(denied.status,404);
  }
 }finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
});
