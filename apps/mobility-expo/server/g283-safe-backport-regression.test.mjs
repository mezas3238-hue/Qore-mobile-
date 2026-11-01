import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
const source=path=>readFile(new URL(path,import.meta.url),'utf8');
test('G283 preserve deployed G272 PG17 composite table probe and G260 AAL2',async()=>{
 const runtime=await source('./g4-staging-runtime.mjs');
 const entry=await source('./run-g4-railway-staging.mjs');
 const transport=await source('./g4-loopback-http-transport.mjs');
 assert.match(runtime,/select\('\*',\{head:true\}\)\.limit\(0\)/);
 assert.doesNotMatch(runtime,/select\('id',\{head:true,count:'exact'\}\)/);
 assert.match(runtime,/createQoreG260AdminAal2Trust/);
 assert.match(runtime,/const adminNativeTrace=/);
 assert.match(transport,/adminNativeTraceGet/);
 assert.match(entry,/QORE_G260_ADMIN_AAL2_APPROVED/);
 assert.match(entry,/g260AdminAal2Approved/);
});
test('G283 staged vehicle endpoint defaults to OFF and requires explicit flag',async()=>{
 const runtime=await source('./g4-staging-runtime.mjs');
 const entry=await source('./run-g4-railway-staging.mjs');
 assert.match(runtime,/g282VehicleDraftApproved=false/);
 assert.match(runtime,/g282VehicleTrust=g282VehicleDraftApproved\?/);
 assert.match(runtime,/g282VehicleDraft===null\?\{\}:\{g282VehicleDraftHandler:guard\(g282VehicleDraft\)\}/);
 assert.match(entry,/env\.QORE_G282_VEHICLE_DRAFT_APPROVED==='true'/);
 assert.match(entry,/QORE_RAILWAY_NO_COMMERCIAL_TRIPS/);
 assert.match(entry,/LIVE_TRIPS_ENABLED/);
});
test('G283 original G4 HTTP transport can route pending vehicle draft only if handler wired',async()=>{
 const other=()=>({status:404,body:{error:'unavailable'}});
 const core={riderHandler:other,offerHandler:other,tripCommandHandler:other,
 deliveryHandler:other,merchantHandler:other,financeHandler:other,
 safetyHandler:other,merchantManagementHandler:other,deliveryOfferHandler:other};
 for(const present of [false,true]){
  const seen=[];
  const server=createQoreRadarLoopbackTransport({...core,
   ...(present?{g282VehicleDraftHandler:input=>{
    seen.push(input);
    return {status:202,body:{mode:'STAGING_DEMO_ONLY',
      status:'pending',commercialEnabled:false}};
   }}:{})});
  const origin=await listenQoreRadarLoopback(server);
  try{
   const res=await fetch(origin+'/v1/staging/vehicle-applications',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestKey:'00000000-0000-4000-8000-000000000401'})
   });
   assert.equal(res.status,present?202:503);
   assert.equal(seen.length,present?1:0);
   if(present)assert.equal(seen[0].path,'/v1/staging/vehicle-applications');
   const get=await fetch(origin+'/v1/staging/vehicle-applications');
   assert.equal(get.status,404);
  }finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
 }
});
