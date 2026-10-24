import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const now=1800000000000;
const id=n=>'a1111111-1111-4111-8111-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),trip=id(3),foreign=id(4);
const token='passenger-historical-session-jwt-1234567';
const history=(patch={},itemPatch={})=>({
 ownerId:owner,generatedAt:now-500,expiresAt:now+60000,nextCursor:null,
 items:[{serviceId:trip,kind:'RIDE',status:'searching',
  createdAt:now-15000,revision:2,...itemPatch}],...patch
});
const ride=(patch={})=>({
 tripId:trip,ownerId:owner,revision:3,state:'searching',
 assignmentPersisted:false,driver:null,vehicle:null,gpsConsent:false,
 location:null,etaVerified:false,etaMinutes:null,mode:'STAGING_DEMO_ONLY',
 commercialRidesEnabled:false,event:{source:'server',tripId:trip,passengerId:owner,
  serverRevision:3,trackingSequence:2,status:'searching',
  acceptedDriver:null,tracking:null},
 locationVisible:false,deliveryConfirmed:false,...patch
});
const response=(data,status=200)=>({ok:status===200,status,redirected:false,
 headers:{get:key=>key==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
function fixture({historyEnabled=true,statusEnabled=true,
 historyDto=history(),statusResponse=async()=>response(ride())}={}){
 let user={subject:owner,role:'passenger',token,expiresAt:now+180000};
 let historyGets=0,statusGets=0;
 const client=createClientExperience({
  now:()=>now,
  authProvider:{readSession:async()=>user,signOut:async()=>{}},
  historyGatewayOptions:{enabled:historyEnabled,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async(url,req)=>{
    historyGets++;
    assert.equal(req.method,'GET');
    assert.equal(url,'https://staging.example.invalid/v1/staging/rider/history');
    assert.equal(req.headers.Authorization,'Bearer '+token);
    return response(historyDto);
   }},
  statusGatewayOptions:{enabled:statusEnabled,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async(url,req)=>{
    statusGets++;
    assert.equal(req.method,'GET');
    assert.equal(url,'https://staging.example.invalid/v1/staging/rider/trips/'+trip+'/status');
    return statusResponse();
   }}
 });
 return {client,historyGets:()=>historyGets,statusGets:()=>statusGets,
  setUser:next=>user=next};
}
async function setup(f){
 assert.equal((await f.client.refreshSession()).ok,true);
 assert.equal((await f.client.loadHistoryPage({reset:true})).ok,true);
}
const resume=f=>f.client.resumeRideFromHistory({tripId:trip,expectedHistoryRevision:2});
test('F1 restart: GET own history then independently GET own SQL trip, safely reconnects tracking',async()=>{
 const f=fixture();
 assert.equal((await f.client.refreshSession()).ok,true);
 assert.equal(f.client.snapshot().rideHistoryRecovery.readReady,false);
 assert.equal(f.client.snapshot().tracking.subscriptionActive,false);
 await f.client.loadHistoryPage({reset:true});
 assert.equal(f.client.snapshot().rideHistoryRecovery.readReady,true);
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
 const result=await resume(f);
 assert.equal(result.ok,true);
 const snap=f.client.snapshot();
 assert.equal(snap.tracking.tripId,trip);
 assert.equal(snap.tracking.state,'searching');
 assert.equal(snap.rideContinuation.canVerify,true);
 assert.equal(snap.rideContinuation.tripId,trip);
 assert.equal(snap.rideHistoryRecovery.productionEnabled,false);
 assert.equal(f.historyGets(),1);
 assert.equal(f.statusGets(),1);
 assert.equal(JSON.stringify(snap).includes(token),false);
});
test('F1 injected history from UI cannot grant a trip recovery or call HTTP status',async()=>{
 const f=fixture();await f.client.refreshSession();
 assert.equal(f.client.acceptHistory(history()),true);
 assert.equal(f.client.snapshot().rideHistoryRecovery.readReady,false);
 assert.equal((await resume(f)).code,'RIDE_HISTORY_NOT_CERTIFIED');
 assert.equal(f.statusGets(),0);
});
test('F1 missing history or status certified gate never authorizes resume',async()=>{
 for(const config of [{historyEnabled:false},{statusEnabled:false}]){
  const f=fixture(config);await f.client.refreshSession();
  if(config.historyEnabled!==false)await f.client.loadHistoryPage({reset:true});
  assert.equal(f.client.snapshot().rideHistoryRecovery.readReady,false);
  assert.equal((await resume(f)).ok,false);
  assert.equal(f.statusGets(),0);
 }
});
test('F1 other account history and invalid history revision cannot become Passenger trip',async()=>{
 const f=fixture({historyDto:history({ownerId:other})});
 await f.client.refreshSession();
 assert.equal((await f.client.loadHistoryPage({reset:true})).ok,false);
 assert.equal((await resume(f)).ok,false);
 assert.equal(f.statusGets(),0);
 const g=fixture();await setup(g);
 assert.equal((await g.client.resumeRideFromHistory({
  tripId:trip,expectedHistoryRevision:1})).code,'RIDE_NOT_ACTIVE_IN_OWN_HISTORY');
 assert.equal((await g.client.resumeRideFromHistory({
  tripId:foreign,expectedHistoryRevision:2})).code,'RIDE_NOT_ACTIVE_IN_OWN_HISTORY');
 assert.equal(g.statusGets(),0);
});
test('F1 cancelled/completed history cannot resume even when status GET might be current',async()=>{
 for(const state of ['completed','cancelled','failed']){
  const f=fixture({historyDto:history({},{status:state})});
  await setup(f);
  assert.equal((await resume(f)).code,'RIDE_NOT_ACTIVE_IN_OWN_HISTORY');
  assert.equal(f.statusGets(),0);
 }
});
test('F1 authoritative GET says completed: never recreate an active Driver trip',async()=>{
 const f=fixture({statusResponse:async()=>response(ride({
  state:'completed',revision:5,
  event:{source:'server',tripId:trip,passengerId:owner,
   serverRevision:5,trackingSequence:4,status:'completed',
   acceptedDriver:null,tracking:null}
 }))});
 await setup(f);
 assert.equal((await resume(f)).code,'RIDE_RESUME_NOT_VERIFIED');
 assert.equal(f.client.snapshot().tracking.subscriptionActive,false);
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
});
test('F1 status 503 or cross-owner result cannot resume, rollback subscription',async()=>{
 for(const statusResponse of [
  async()=>({ok:false,status:503,redirected:false}),
  async()=>response(ride({ownerId:other})),
  async()=>response(ride({revision:1,
   event:{source:'server',tripId:trip,passengerId:owner,
    serverRevision:1,trackingSequence:0,status:'searching',
    acceptedDriver:null,tracking:null}}))
 ]){
  const f=fixture({statusResponse});await setup(f);
  assert.equal((await resume(f)).code,'RIDE_RESUME_NOT_VERIFIED');
  assert.equal(f.client.snapshot().tracking.subscriptionActive,false);
  assert.equal(f.client.snapshot().tracking.assignedDriver,null);
  assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
 }
});
test('F1 JWT rotation while status GET outstanding prevents cross-session reattachment',async()=>{
 let release;
 const deferred=new Promise(resolve=>release=resolve);
 const f=fixture({statusResponse:async()=>deferred});await setup(f);
 const pending=resume(f);
 await Promise.resolve();await Promise.resolve();
 assert.equal((await resume(f)).code,'RIDE_RESUME_IN_FLIGHT');
 f.setUser({subject:owner,role:'passenger',
  token:'rotated-passenger-jwt-safe-789012345',expiresAt:now+180000});
 await f.client.refreshSession();
 release(response(ride()));
 assert.equal((await pending).ok,false);
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
 assert.equal(f.client.snapshot().tracking.subscriptionActive,false);
});
test('F1 recovered trip cannot be requested again while already subscribed',async()=>{
 const f=fixture();await setup(f);
 assert.equal((await resume(f)).ok,true);
 assert.equal((await resume(f)).code,'RIDE_ALREADY_TRACKED');
 assert.equal(f.statusGets(),1);
});
test('F1 logout and synthetic replacement of history revoke ability to resume',async()=>{
 const f=fixture();await setup(f);
 assert.equal(f.client.snapshot().rideHistoryRecovery.readReady,true);
 assert.equal(f.client.acceptHistory(history()),true);
 assert.equal(f.client.snapshot().rideHistoryRecovery.readReady,false);
 assert.equal((await resume(f)).ok,false);
 await f.client.signOut();
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
 assert.equal(f.client.snapshot().rideHistoryRecovery.readReady,false);
});
