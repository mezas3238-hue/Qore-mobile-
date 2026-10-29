import test from 'node:test';
import assert from 'node:assert/strict';
import {createG177VerifiedAutoDriverStepGateway} from './g177-verified-auto-driver-step-gateway.mjs';

const DRIVER='22222222-2222-4222-8222-222222222222';
const SESSION='33333333-3333-4333-8333-333333333333';
const TRIP='44444444-4444-4444-8444-444444444444';
const EVENT='55555555-5555-4555-8555-555555555555';
const PATH='/v1/staging/trips/'+TRIP+'/transition';
const TOKEN='g210_staging_driver_token_123456789';
const request=(body,method='POST',path=PATH)=>({
 method,path,body,headers:{authorization:'Bearer '+TOKEN}
});
function fixture({onLegacy=async()=>({status:409}),onCommit=async()=>EVENT,
 onRevocation=async()=>true}={}){
 let legacyCalls=0,commitCalls=0;
 const gateway=createG177VerifiedAutoDriverStepGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  legacyGateway:async input=>{legacyCalls++;return onLegacy(input);},
  verifyAccessToken:async()=>({
   id:DRIVER,sessionId:SESSION,tokenIatMs:1000,
   expiresAtMs:100000,is_anonymous:false
  }),
  verifySessionNotRevoked:onRevocation,
  resolveExclusiveRole:async()=> 'driver',
  allowRequest:()=>true,
  commitStep:async params=>{commitCalls++;return onCommit(params);},
  now:()=>2000
 });
 return {gateway,counts:()=>({legacyCalls,commitCalls})};
}

test('G210 unknown or malformed original AUTO transitions never reach legacy G4',async()=>{
 const {gateway,counts}=fixture({onLegacy:async()=>({
  status:200,body:{serverPersisted:true}
 })});
 const invalid=[
  undefined,
  {},
  {event:'finish',eventKey:EVENT},
  {event:'arrive',eventKey:'invalid'},
  {event:'arrive',eventKey:EVENT,force:true},
  {event:'pickup',eventKey:EVENT,driverId:DRIVER},
  {event:'complete',eventKey:null}
 ];
 for(const body of invalid){
  const r=await gateway(request(body));
  assert.equal(r.status,400,JSON.stringify(body));
  assert.equal(r.body.code,'G177_DRIVER_STEP_INVALID');
  assert.equal(r.body.retrySafe,false);
 }
 assert.deepEqual(counts(),{legacyCalls:0,commitCalls:0},
  'Malformed Driver transition must not reach weaker original G4');
});

test('G210 preserves only the G184 Passenger cancellation fence as legacy transition',async()=>{
 const {gateway,counts}=fixture({onLegacy:async()=>({
  status:409,body:{code:'G184_USE_ORIGINAL_G73_G95_AUTO_BOOKING'}
 })});
 const cancelled=await gateway(request({event:'cancel',eventKey:EVENT}));
 assert.equal(cancelled.status,409);
 assert.equal(cancelled.body.code,'G184_USE_ORIGINAL_G73_G95_AUTO_BOOKING');
 assert.deepEqual(counts(),{legacyCalls:1,commitCalls:0});
});

test('G210 valid Driver step remains session-verified and source-committed',async()=>{
 let params;
 const {gateway,counts}=fixture({onCommit:async x=>{params=x;return EVENT;}});
 const result=await gateway(request({event:'arrive',eventKey:EVENT}));
 assert.equal(result.status,200);
 assert.equal(result.body.tripId,TRIP);
 assert.equal(result.body.eventId,EVENT);
 assert.equal(result.body.commercialRidesEnabled,false);
 assert.deepEqual(params,{actorId:DRIVER,sessionId:SESSION,tokenIatMs:1000,
  tripId:TRIP,event:'arrive',eventKey:EVENT});
 assert.deepEqual(counts(),{legacyCalls:0,commitCalls:1});
});

test('G210 post-COMMIT session revocation cannot return a confirmed receipt',async()=>{
 let checks=0;
 const {gateway,counts}=fixture({
  onRevocation:async()=>++checks===1
 });
 const result=await gateway(request({event:'arrive',eventKey:EVENT}));
 assert.equal(result.status,401);
 assert.equal(result.body.code,'G177_DRIVER_REVOKED');
 assert.equal(result.body.retrySafe,false);
 assert.deepEqual(counts(),{legacyCalls:0,commitCalls:1},
  'Client must reconcile original eventKey instead of retrying unknown COMMIT');
});
