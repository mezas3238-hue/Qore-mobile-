import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
import {createF1FocusedTrackingSync} from './f1-focused-tracking-sync.mjs';

const clock=1800000000000;
const id=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const subject=id(1),other=id(2),trip=id(3),requestKey=id(4);
const token='qa-passenger-jwt-verified-token-abcdefghij';
const body={requestKey,originTag:'CENTRO',destinationTag:'SHOPPING',service:'economico'};
const receipt=(patch={})=>({mode:'STAGING_DEMO_ONLY',
 commercialEnabled:false,ownerId:subject,requestKey,operation:'rideRequest',
 serviceId:trip,revision:1,serverPersisted:true,status:'ACCEPTED_QA',...patch});
const status=(patch={})=>({tripId:trip,ownerId:subject,revision:1,state:'searching',
 assignmentPersisted:false,driver:null,vehicle:null,gpsConsent:false,
 location:null,etaVerified:false,etaMinutes:null,mode:'STAGING_DEMO_ONLY',
 commercialRidesEnabled:false,event:{
  source:'server',tripId:trip,passengerId:subject,
  serverRevision:1,trackingSequence:0,status:'searching',
  acceptedDriver:null,tracking:null},
 locationVisible:false,deliveryConfirmed:false,...patch});
const response=(data,httpStatus=200)=>({ok:httpStatus>=200&&httpStatus<300,
 status:httpStatus,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const common={enabled:true,contractCertified:true,
 origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid'};
function setup({bookingEnabled=true,statusEnabled=true,
 bookingReply=async()=>response(receipt(),201),
 statusReply=async()=>response(status()),
 reconciliationRead=null}={}){
 let identity={subject,role:'passenger',token,expiresAt:clock+120000};
 let post=0,get=0;
 const client=createClientExperience({
  now:()=>clock,
  authProvider:{readSession:async()=>identity,signOut:async()=>{}},
  bookingHttpOptions:{...common,enabled:bookingEnabled,
   stagingRuntimeVerified:true,qaReceiptContractCertified:true,
   reconciliationContractCertified:Boolean(reconciliationRead),
   reconciliationRead,
   fetchImpl:async(url,req)=>{post++;assert.equal(req.method,'POST');
    assert(url.endsWith('/rider/trips/request'));
    return bookingReply(url,req);}},
  statusGatewayOptions:{...common,enabled:statusEnabled,
   fetchImpl:async(url,req)=>{get++;assert.equal(req.method,'GET');
    assert(url.endsWith('/rider/trips/'+trip+'/status'));
    return statusReply(url,req);}}
 });
 return {client,posts:()=>post,reads:()=>get,setIdentity:x=>identity=x,
  currentIdentity:()=>identity};
}
async function request(f){
 assert.equal((await f.client.refreshSession()).ok,true);
 assert.equal(f.client.prepareRide(body).ok,true);
 return f.client.submit();
}
test('F1 verified QA booking -> GET own server searching status -> active tracking with no Driver/fare',async()=>{
 const f=setup(),result=await request(f);
 assert.equal(result.ok,true);
 assert.equal(f.client.snapshot().rideContinuation.canVerify,true);
 assert.equal(f.client.snapshot().rideContinuation.tripId,trip);
 assert.equal(f.client.snapshot().tracking.subscriptionActive,false);
 assert.equal((await f.client.continueVerifiedRide()).ok,true);
 const s=f.client.snapshot();
 assert.equal(s.tracking.subscriptionActive,true);
 assert.equal(s.tracking.tripId,trip);
 assert.equal(s.tracking.state,'searching');
 assert.equal(s.tracking.assignedDriver,null);
 assert.equal(s.quote,null);
 assert.equal(f.posts(),1);assert.equal(f.reads(),1);
 assert.equal(s.rideContinuation.productionEnabled,false);
 assert.equal(JSON.stringify(s).includes(token),false);
});
test('F1 generic 201 without signed receipt never unlocks verified tracking',async()=>{
 const f=setup({bookingReply:async()=>response({tripId:trip},201)});
 assert.equal((await request(f)).code,'BOOKING_RECEIPT_NOT_CERTIFIED');
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.client.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.reads(),0);
});
test('F1 direct legacy ack 201 has no verified ride even if mutation controller acknowledges',async()=>{
 const c=createClientExperience({now:()=>clock,
  authProvider:{readSession:async()=>({
   subject,role:'passenger',token,expiresAt:clock+120000})},
  gateway:{send:async()=>({ok:true,status:201,data:receipt(),qaOnly:true,
   commercialEnabled:false,bookingConfirmedForProduction:false})}
 });
 await c.refreshSession();c.prepareRide(body);
 assert.equal((await c.submit()).ok,true);
 assert.equal(c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await c.continueVerifiedRide()).ok,false);
});
test('F1 missing status cert leaves persisted ride disconnected; no fake GET',async()=>{
 const f=setup({statusEnabled:false});
 assert.equal((await request(f)).ok,true);
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.client.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.reads(),0);
});
test('F1 HTTP status 503 after booking does not display a searching/assigned phantom trip',async()=>{
 const f=setup({statusReply:async()=>({ok:false,status:503,redirected:false})});
 assert.equal((await request(f)).ok,true);
 assert.equal((await f.client.continueVerifiedRide()).code,'RIDE_STATUS_NOT_VERIFIED');
 const snap=f.client.snapshot();
 assert.equal(snap.tracking.subscriptionActive,false);
 assert.equal(snap.tracking.tripId,null);
 assert.equal(snap.tracking.assignedDriver,null);
 assert.equal(f.posts(),1);assert.equal(f.reads(),1);
});
test('F1 cross-owner GET 200 must not expose foreign status or resume',async()=>{
 const f=setup({statusReply:async()=>response(status({ownerId:other}))});
 await request(f);
 assert.equal((await f.client.continueVerifiedRide()).code,'RIDE_STATUS_NOT_VERIFIED');
 assert.equal(f.client.snapshot().tracking.tripId,null);
});
test('F1 stale JWT between POST receipt and GET discards proof before network read',async()=>{
 const f=setup();await request(f);
 const old=f.currentIdentity();
 f.setIdentity({...old,token:'rotated-passenger-jwt-12345678901234'});
 await f.client.refreshSession();
 assert.equal(f.client.snapshot().rideContinuation.tripId,null);
 assert.equal((await f.client.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.reads(),0);
});
test('F1 JWT rotation in-flight GET never resurrects trip in new session',async()=>{
 let release;
 const waiting=new Promise(resolve=>release=resolve);
 const f=setup({statusReply:async()=>waiting});
 await request(f);
 const ongoing=f.client.continueVerifiedRide();
 await Promise.resolve();await Promise.resolve();
 f.setIdentity({...f.currentIdentity(),token:'rotated-passenger-jwt-12345678901234'});
 await f.client.refreshSession();
 release(response(status()));
 assert.equal((await ongoing).ok,false);
 assert.equal(f.client.snapshot().tracking.tripId,null);
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
});
test('F1 201 ACK lost -> owner-scoped reconciliation GET -> verified ride status with zero booking replay',async()=>{
 const f=setup({bookingReply:async()=>response({tripId:trip},201),
  reconciliationRead:async scope=>{
   assert.equal(scope.operation,'rideRequest');
   assert.equal(scope.expectedSubject,subject);
   assert.equal(scope.requestKey,requestKey);
   return {ok:true,status:200,data:receipt()};
  }});
 assert.equal((await request(f)).code,'BOOKING_RECEIPT_NOT_CERTIFIED');
 assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.client.reconcileBooking()).ok,true);
 assert.equal(f.client.snapshot().rideContinuation.tripId,trip);
 assert.equal((await f.client.continueVerifiedRide()).ok,true);
 assert.equal(f.posts(),1);assert.equal(f.reads(),1);
});
test('F1 a response with extra proof, Driver identity or altered requestKey cannot supply a trip',async()=>{
 for(const patch of [
  {requestKey:id(9)},{ownerId:other},{serverPersisted:false},
  {courierId:other},{commercialEnabled:true},{revision:0}
 ]){
  const f=setup({bookingReply:async()=>response(receipt(patch),201)});
  assert.equal((await request(f)).ok,false,JSON.stringify(patch));
  assert.equal(f.client.snapshot().rideContinuation.canVerify,false);
  assert.equal(f.reads(),0);
 }
});


test('F1 real ClientExperience view follows Server Driver lifecycle and hides Driver at completion',async()=>{
 const vocabulary={searching:'searching',assigned:'accepted',
  arriving:'at_pickup',in_progress:'in_progress',completed:'completed'};
 const states=['searching','assigned','arriving','in_progress','completed'];
 let stage=0;
 const makeStatus=()=>{
  const state=states[stage],revision=stage+1;
  const active=['assigned','arriving','in_progress'].includes(state);
  const driver=active?{verified:true,displayName:'Conductor Sintético'}:null;
  const vehicle=active?{kind:'AUTO',plate:'QA-777'}:null;
  const eventDriver=active?{name:'Conductor Sintético',vehicleKind:'AUTO',
   model:'Toyota',color:'blanco',plate:'QA-777',rating:4.8}:null;
  return status({state,revision,assignmentPersisted:stage>0,
   driver,vehicle,
   event:{source:'server',tripId:trip,passengerId:subject,
    serverRevision:revision,trackingSequence:stage,
    status:vocabulary[state],acceptedDriver:eventDriver,tracking:null}});
 };
 const f=setup({statusReply:async()=>response(makeStatus())});
 assert.equal((await request(f)).ok,true);
 assert.equal((await f.client.continueVerifiedRide()).ok,true);
 assert.equal(f.client.snapshot().tracking.state,'searching');
 assert.equal(f.client.snapshot().tracking.assignedDriver,null);
 for(let i=1;i<states.length;i++){
  stage=i;
  assert.equal((await f.client.syncTracking()).ok,true,states[i]);
  const shown=f.client.snapshot().tracking;
  assert.equal(shown.state,states[i]);
  assert.equal(shown.revision,i+1);
  if(i<4){assert.equal(shown.assignedDriver.plate,'QA-777');}
 }
 const finished=f.client.snapshot().tracking;
 assert.equal(finished.state,'completed');
 assert.equal(finished.assignedDriver,null);
 assert.equal(finished.etaMinutes,null);
 assert.equal(finished.position,null);
 assert.equal(f.client.snapshot().quote,null);
 assert.equal(f.posts(),1);
 assert.equal(f.reads(),5);
});
test('F1 ClientExperience rejects old Driver SQL status after an already completed ride',async()=>{
 let payload=status();
 const f=setup({statusReply:async()=>response(payload)});
 await request(f);await f.client.continueVerifiedRide();
 payload=status({state:'completed',revision:5,
  event:{source:'server',tripId:trip,passengerId:subject,
   serverRevision:5,trackingSequence:4,status:'completed',
   acceptedDriver:null,tracking:null}});
 assert.equal((await f.client.syncTracking()).ok,true);
 assert.equal(f.client.snapshot().tracking.state,'completed');
 payload=status({state:'assigned',revision:6,assignmentPersisted:true,
  event:{source:'server',tripId:trip,passengerId:subject,
   serverRevision:6,trackingSequence:5,status:'accepted',
   acceptedDriver:null,tracking:null}});
 assert.equal((await f.client.syncTracking()).code,'TRIP_STATE_CONFLICT');
 assert.equal(f.client.snapshot().tracking.state,'completed');
 assert.equal(f.client.snapshot().tracking.position,null);
});

test('F1 integrated: Passenger booking → tracking → foreground refresh → completed → stop HTTP reads',async()=>{
 let latest=status(),callback=null,clearCount=0;
 const f=setup({statusReply:async()=>response(latest)});
 assert.equal((await request(f)).ok,true);
 assert.equal((await f.client.continueVerifiedRide()).ok,true);
 assert.equal(f.reads(),1);
 const loop=createF1FocusedTrackingSync({
  readSnapshot:()=>f.client.snapshot(),
  syncTracking:()=>f.client.syncTracking(),
  schedule:(fn,ms)=>{assert.equal(ms,12000);callback=fn;return 1;},
  cancel:()=>{clearCount++;}
 });
 assert.equal(loop.start().ok,true);
 assert.equal(f.reads(),1,'verified continuation already performed the first GET');
 const assigned={
  name:'Conductor Sintético',vehicleKind:'AUTO',model:'Toyota',
  color:'blanco',plate:'QA-777',rating:4.8
 };
 latest=status({state:'assigned',revision:2,assignmentPersisted:true,
  driver:{verified:true,displayName:assigned.name},
  vehicle:{kind:'AUTO',plate:assigned.plate},
  event:{source:'server',tripId:trip,passengerId:subject,serverRevision:2,
   trackingSequence:1,status:'accepted',acceptedDriver:assigned,tracking:null}
 });
 await callback();
 assert.equal(f.client.snapshot().tracking.state,'assigned');
 assert.equal(f.client.snapshot().tracking.assignedDriver?.plate,'QA-777');
 latest=status({state:'completed',revision:5,assignmentPersisted:true,
  event:{source:'server',tripId:trip,passengerId:subject,serverRevision:5,
   trackingSequence:4,status:'completed',acceptedDriver:null,tracking:null}
 });
 await callback();
 assert.equal(f.client.snapshot().tracking.state,'completed');
 assert.equal(f.client.snapshot().tracking.assignedDriver,null);
 assert.equal(loop.isActive(),false);
 assert.equal(clearCount,1);
 const last=f.reads();
 await callback();
 assert.equal(f.reads(),last,'no background HTTP after terminal status');
 assert.equal(f.posts(),1,'foreground cannot create another booking');
});
