import test from 'node:test';
import assert from 'node:assert/strict';
import {createG197DriverPickupGateway} from './g197-driver-pickup-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
const driver='19700000-0000-4197-8197-000000000001';
const session='19700000-0000-4197-8197-000000000002';
const token='trusted-driver-identity-0000000000000000001';
const now=1793300000000;
const path='/v1/staging/driver/pickup-preferences';
const noop=()=>({status:404,body:{error:'not found'}});
function fixture(overrides={}){
 let role='driver',revoked=false;
 let saves=0;
 const gateway=createG197DriverPickupGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,now:()=>now,
  verifyAccessToken:async()=>({id:driver,sessionId:session,
   tokenIatMs:now-100,expiresAtMs:now+60000,is_anonymous:false}),
  verifySessionNotRevoked:async()=>!revoked,
  resolveExclusiveRole:async()=>role,
  allowRequest:()=>true,
  readPreferences:async()=>({mode:'STAGING_DEMO_ONLY',driverId:driver,
   preferences:[{serviceKind:'RIDE',maximumRoadMeters:5000,revision:1}],
   liveEnabled:false,productionEnabled:false}),
  savePreference:async({serviceKind,maximumRoadMeters,expectedRevision})=>{
   saves++;
   return {mode:'STAGING_DEMO_ONLY',driverId:driver,
    serviceKind,maximumRoadMeters,revision:expectedRevision+1,
    serverPersisted:true,liveEnabled:false,productionEnabled:false};
  },...overrides
 });
 return {gateway,role:x=>role=x,revoked:x=>revoked=x,saves:()=>saves};
}
const request=(method,body)=>({path,method,
 headers:{authorization:'Bearer '+token},...(body?{body}:{})});
test('G197 Driver chooses exact road pickup meters per service; SQL revision used',async()=>{
 const f=fixture();
 const read=await f.gateway(request('GET'));
 assert.equal(read.status,200);assert.equal(read.body.preferences[0].maximumRoadMeters,5000);
 const saved=await f.gateway(request('PUT',{serviceKind:'MERCHANT_ORDER',
  maximumRoadMeters:2000,expectedRevision:0}));
 assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
 assert.equal(f.saves(),1);
 assert.equal(saved.body.productionEnabled,false);
});
test('G228 OFF is a persisted per-service choice, not a forged kilometre',async()=>{
 const f=fixture();
 const saved=await f.gateway(request('PUT',{serviceKind:'MERCHANT_ORDER',
  maximumRoadMeters:0,expectedRevision:0}));
 assert.equal(saved.status,200);
 assert.equal(saved.body.maximumRoadMeters,0);
 assert.equal(saved.body.serviceKind,'MERCHANT_ORDER');
 assert.equal(saved.body.revision,1);
 assert.equal(saved.body.productionEnabled,false);
 assert.equal(f.saves(),1);
});
test('G197 forbids Passenger/forged radius/direct body authority/revoked Driver',async()=>{
 const f=fixture();
 f.role('passenger');
 assert.equal((await f.gateway(request('PUT',{serviceKind:'RIDE',
  maximumRoadMeters:5000,expectedRevision:0}))).status,403);
 f.role('driver');
 for(const bad of [
  {serviceKind:'RIDE',maximumRoadMeters:50,expectedRevision:0},
  {serviceKind:'UNKNOWN',maximumRoadMeters:5000,expectedRevision:0},
  {serviceKind:'MERCHANT_ORDER',maximumRoadMeters:5000,expectedRevision:0,
   driverId:driver},
 ]){
  assert.equal((await f.gateway(request('PUT',bad))).status,400);
 }
 f.revoked(true);
 assert.equal((await f.gateway(request('GET'))).status,401);
 assert.equal(f.saves(),0);
});
test('G197 rejects unverified SQL setting or altered owner receipt',async()=>{
 const f=fixture({savePreference:async()=>({mode:'STAGING_DEMO_ONLY',
  driverId:session,serviceKind:'RIDE',maximumRoadMeters:10000,revision:2,
  serverPersisted:true,liveEnabled:false,productionEnabled:false})});
 assert.equal((await f.gateway(request('PUT',{serviceKind:'RIDE',
  maximumRoadMeters:10000,expectedRevision:1}))).status,503);
});
test('G197 HTTP G4 loopback endpoints mounted only with supplied authorities',async t=>{
 const f=fixture();
 const create=h=>createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,deliveryHandler:noop,
  merchantHandler:noop,financeHandler:noop,safetyHandler:noop,
  merchantManagementHandler:noop,deliveryOfferHandler:noop,
  ...(h?{pickupPreferenceHandler:h}:{})
 });
 const server=create(f.gateway),base=await listenQoreRadarLoopback(server);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const read=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
 assert.equal(read.status,200);
 const post=await fetch(base+path,{method:'PUT',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify({serviceKind:'DELIVERY',maximumRoadMeters:3000,expectedRevision:0})});
 assert.equal(post.status,200);
 const missing=create(),other=await listenQoreRadarLoopback(missing);
 t.after(()=>new Promise(resolve=>missing.close(resolve)));
 assert.equal((await fetch(other+path,{headers:{authorization:'Bearer '+token}})).status,503);
});
