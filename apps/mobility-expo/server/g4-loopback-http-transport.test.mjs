/**
 * TRUE HTTP over 127.0.0.1, three SYNTHETIC actors, mocked Auth/DB/Push.
 * These are NOT real Supabase JWTs, devices or Google traffic/GPS.
 * G4 PostgreSQL concurrency is tested independently in ephemeral PG16 CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createQoreRiderStatusGateway} from './g4-rider-status-gateway.mjs';
import {createQoreOfferGateway} from './g4-offer-gateway.mjs';
import {createQoreTripCommandGateway} from './g4-trip-command-gateway.mjs';
import {createQoreDeliveryCommandGateway} from './g5-delivery-command-gateway.mjs';
import {makePrivateDriverPush} from './g4-qore-radar-core.mjs';
import {createExpoPrivateOfferSender} from './g4-expo-push-offers.mjs';

const ref='staging1234567890abcd';
const riderId='11111111-1111-4111-8111-111111111111';
const driverA='22222222-2222-4222-8222-222222222222';
const driverB='33333333-3333-4333-8333-333333333333';
const outsider='44444444-4444-4444-8444-444444444444';
const tripId='55555555-5555-4555-8555-555555555555';
const offerA='66666666-6666-4666-8666-666666666666';
const offerB='77777777-7777-4777-8777-777777777777';
const carA='88888888-8888-4888-8888-888888888888';
const carB='99999999-9999-4999-8999-999999999999';
const keyA='aaaa0000-0000-4000-8000-000000000001';
const keyB='bbbb0000-0000-4000-8000-000000000002';
const deliveryId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const deliveryProof='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const fakeBearer=id=>'synthetic_fixture_'+id.replaceAll('-','')+'_never_real';
const auth=id=>({authorization:'Bearer '+fakeBearer(id)});
const offerPath=id=>'/v1/staging/driver/offers/'+id;
const riderPath='/v1/staging/rider/trips/'+tripId+'/status';
function fixture(){
 const state={
  at:200_000,
  gpsAt:198_000,
  routeAt:199_000,
  accepted:0,
  delivery:null,
  trip:{id:tripId,passengerId:riderId,driverId:null,vehicleId:null,
   status:'searching',revision:1,trackingSequence:0},
  offers:new Map([
   [offerA,{driverId:driverA,vehicleId:carA,status:'offered'}],
   [offerB,{driverId:driverB,vehicleId:carB,status:'offered'}]
  ]),
 };
 const verified=async token=>{
  const id=[riderId,driverA,driverB,outsider].find(id=>fakeBearer(id)===token);
  if(!id)throw Error('Synthetic unauthorized Auth fixture');
  return {id,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'};
 };
 const rider=createQoreRiderStatusGateway({
  projectRef:ref,verifyAccessToken:verified,now:()=>state.at,
  authorizePassenger:async id=>id===riderId,
  allowRequest:()=>true,
  loadOwnTrip:async({tripId:id,passengerId:id2})=>
   id===tripId&&id2===riderId?{...state.trip}:null,
  loadArrivalEvidence:async({driverId,vehicleId})=>{
   if(driverId!==state.trip.driverId||vehicleId!==state.trip.vehicleId)
    throw Error('Assigned actor mismatch');
   return {
    driverProfile:{driverId,vehicleId,verifiedForDisplay:true,
     displayName:'Conductor QORE Sintético',vehicleKind:'AUTO',
     vehicleModel:'Toyota Vitz',color:'gris',plate:'TEST777',rating:4.8},
    location:{lat:-25.30,lng:-57.61,consentGranted:true,available:true,
     capturedAtMs:state.gpsAt,accuracyMeters:14},
    route:{driverId,provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,
     fallbackUsed:false,calculatedAtMs:state.routeAt,
     roadMeters:2150,etaSeconds:300}
   };
  },
 });
 const offer=createQoreOfferGateway({
  projectRef:ref,verifyAccessToken:verified,now:()=>state.at,
  authorizeDriver:async id=>id===driverA||id===driverB,
  allowRequest:()=>true,
  loadOfferForDriver:async({offerId,driverId})=>{
   const item=state.offers.get(offerId);
   return item&&item.driverId===driverId?{
    offerId,driverId,tripId,status:item.status,
    expiresAtMs:215_000,service:'economico',
    originTag:'PANTEON',destinationTag:'SHOPPING'
   }:null;
  },
  acceptOffer:async({_offer_id,_driver_id,_decision_key})=>{
   const row=state.offers.get(_offer_id);
   if(!row||row.driverId!==_driver_id||row.status!=='offered'||
      state.trip.status!=='searching'||state.at>=215_000)
    throw Error('No active matching offer');
   state.accepted++;
   row.status='accepted';
   state.trip={...state.trip,driverId:_driver_id,vehicleId:row.vehicleId,
    status:'accepted',revision:2,trackingSequence:1};
   for(const [id,offer] of state.offers)
    if(id!==_offer_id)offer.status='withdrawn';
   return _decision_key;
  },
  declineOffer:async()=>{throw Error('Not used in this fixture')},
 });
 const commands=createQoreTripCommandGateway({
  projectRef:ref,verifyAccessToken:verified,
  resolveRole:async id=>id===riderId?'passenger':
   (id===driverA||id===driverB)?'driver':null,
  allowRequest:()=>true,
  requestTrip:async input=>{
   if(input.actorId!==riderId)throw Error('Not passenger');
   return {ok:true,liveEnabled:false,tripId};
  },
  transitionTrip:async input=>{
   if(input.tripId!==tripId)throw Error('Wrong trip');
   const expected={accepted:'arrive',arriving:'pickup',in_progress:'complete'};
   if(input.actorId===riderId&&input.event==='cancel'&&
      ['searching','accepted','arriving'].includes(state.trip.status)){
    state.trip={...state.trip,status:'cancelled',revision:state.trip.revision+1};
   }else if(input.actorId===state.trip.driverId&&
      expected[state.trip.status]===input.event){
    const status={arrive:'arriving',pickup:'in_progress',complete:'completed'}[input.event];
    state.trip={...state.trip,status,revision:state.trip.revision+1};
   }else throw Error('Transition rejected');
   return {ok:true,liveEnabled:false,eventId:input.eventKey};
  },
 });
 const deliveries=createQoreDeliveryCommandGateway({
  projectRef:ref,verifyAccessToken:verified,
  resolveRole:async id=>id===riderId?'passenger':
   (id===driverA||id===driverB)?'driver':null,
  allowRequest:()=>true,
  requestDelivery:async input=>{
   if(input.actorId!==riderId||state.delivery)throw Error('Not available');
   state.delivery={id:deliveryId,senderId:riderId,courierId:null,vehicleId:null,
    requestedVehicleKind:input.vehicleKind,category:input.category,grams:input.grams,
    dimensionsCm:{length:input.lengthCm,width:input.widthCm,height:input.heightCm},
    pickupTag:input.pickupTag,deliveryTag:input.deliveryTag,status:'requested',
    revision:1,proofRef:null};
   return {ok:true,liveEnabled:false,deliveryId};
  },
  acceptDelivery:async input=>{
   if(input.actorId!==driverA||input.deliveryId!==deliveryId||
      state.delivery?.status!=='requested')throw Error('Cannot accept');
   state.delivery={...state.delivery,courierId:driverA,vehicleId:input.vehicleId,
    status:'accepted',revision:2};
   return {ok:true,liveEnabled:false,eventId:input.requestKey};
  },
  transitionDelivery:async input=>{
   const next={pickup:'picked_up',deliver:'delivered'};
   if(input.actorId!==driverA||state.delivery?.courierId!==driverA||
      !next[input.event])throw Error('Cannot transition');
   state.delivery={...state.delivery,status:next[input.event],
    revision:state.delivery.revision+1,
    proofRef:input.event==='deliver'?input.proofRef:state.delivery.proofRef};
   return {ok:true,liveEnabled:false,eventId:input.eventKey};
  },
  loadDelivery:async input=>{
   if(input.deliveryId!==deliveryId||!state.delivery||
      ![state.delivery.senderId,state.delivery.courierId].includes(input.actorId))
    throw Error('Not a participant');
   return {ok:true,liveEnabled:false,delivery:{...state.delivery}};
  },
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:rider,offerHandler:offer,tripCommandHandler:commands,
  deliveryHandler:deliveries,
  merchantHandler:async()=>({status:404,body:{error:'Not found'}}),
  financeHandler:async()=>({status:404,body:{error:'Not found'}}),
  safetyHandler:async()=>({status:404,body:{error:'Not found'}}),
  merchantManagementHandler:async()=>({status:404,body:{error:'Not found'}}),
  deliveryOfferHandler:async input=>{
   if(input.method!=='POST'||input.path!=='/v1/staging/courier/delivery-offers/accept'||
      input.body?.offerId!==offerA||input.body?.requestKey!==keyB||
      input.headers.authorization!=='Bearer '+fakeBearer(driverA)||
      state.delivery?.status!=='requested')
    return {status:409,body:{error:'Private delivery offer rejected'}};
   state.delivery={...state.delivery,courierId:driverA,vehicleId:carA,
    status:'accepted',revision:2};
   return {status:200,body:{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
    outcome:'accepted',eventId:keyB,serverPersisted:true}};
  },
 });
 return {state,server};
}
async function client(base,path,{method='GET',id=riderId,body,headers={}}={}){
 const res=await fetch(base+path,{
  method,
  headers:{...auth(id),...(body===undefined?{}:{'content-type':'application/json'}),...headers},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  redirect:'error'
 });
 return {status:res.status,body:await res.json(),headers:res.headers};
}
const close=async server=>{
 // Never leak an HTTP fixture listener into another test/CLI.
 await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
};

test('real loopback HTTP: rider searching, private notification, 2 driver race, winning plate and traffic ETA',async t=>{
 const {state,server}=fixture();
 const base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 assert.equal(server.address().address,'127.0.0.1');
 const searching=await client(base,riderPath);
 assert.equal(searching.status,200);
 assert.equal(searching.body.event.status,'searching');
 assert.equal(searching.body.event.acceptedDriver,null);
 assert.equal(searching.body.event.tracking,null);
 const notification=makePrivateDriverPush({
  rideId:tripId,offerId:offerA,driverId:driverA,
  expiresAtMs:215_000,nowMs:state.at
 });
 const sender=createExpoPrivateOfferSender({
  now:()=>state.at,request:async()=>({ok:true,
   json:async()=>({data:{status:'ok',id:'synthetic-ticket-abc'}})})
 });
 const sent=await sender({
  offer:notification,verifiedDriverId:driverA,
  token:'ExponentPushToken[abcdefghijklmnop1234567890]'
 });
 assert.equal(sent.delivered,false,'push ticket != delivered');
 assert.equal((await client(base,riderPath)).body.event.acceptedDriver,null,
  'push ticket != trip accepted');
 const deny=await client(base,offerPath(offerA),{id:driverB});
 assert.equal(deny.status,404,'driver cannot enumerate another offer');
 const open=await client(base,offerPath(offerA),{id:driverA});
 assert.equal(open.status,200);
 assert.equal(open.body.confirmedAcceptance,false);
 const [a,b]=await Promise.all([
  client(base,'/v1/staging/driver/offers/accept',
   {id:driverA,method:'POST',body:{offerId:offerA,requestKey:keyA}}),
  client(base,'/v1/staging/driver/offers/accept',
   {id:driverB,method:'POST',body:{offerId:offerB,requestKey:keyB}})
 ]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);
 assert.equal(state.accepted,1);
 assert.deepEqual([...state.offers.values()].map(x=>x.status).sort(),
  ['accepted','withdrawn']);
 const confirmed=await client(base,riderPath);
 assert.equal(confirmed.status,200);
 assert.equal(confirmed.body.event.status,'accepted');
 assert.equal(confirmed.body.event.serverRevision,2);
 assert.equal(confirmed.body.event.acceptedDriver.plate,'TEST777');
 assert.equal(confirmed.body.event.tracking.roadMeters,2150);
 assert.equal(confirmed.body.event.tracking.etaSeconds,300);
 assert.equal(confirmed.body.locationVisible,true);
 assert.equal(confirmed.body.commercialRidesEnabled,false);
 assert.equal(confirmed.body.deliveryConfirmed,false);
 assert.equal(confirmed.headers.get('cache-control').includes('no-store'),true);
 assert.equal(confirmed.headers.get('access-control-allow-origin'),null);
 const outsiderRead=await client(base,riderPath,{id:outsider});
 assert.equal(outsiderRead.status,403);
 assert.doesNotMatch(JSON.stringify(outsiderRead),/TEST777|-25.30|Conductor QORE/);
 const driverRead=await client(base,riderPath,{id:driverA});
 assert.equal(driverRead.status,403);
});

test('HTTP: GPS/traffic expiry removes marker & countdown without forgetting verified driver',async t=>{
 const {state,server}=fixture(),base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 assert.equal((await client(base,'/v1/staging/driver/offers/accept',{
  method:'POST',id:driverA,body:{offerId:offerA,requestKey:keyA}})).status,200);
 assert.equal((await client(base,riderPath)).body.locationVisible,true);
 state.at=236_000;
 const stale=await client(base,riderPath);
 assert.equal(stale.status,200);
 assert.equal(stale.body.event.acceptedDriver.plate,'TEST777');
 assert.equal(stale.body.event.tracking,null);
 assert.equal(stale.body.locationVisible,false);
 state.trip={...state.trip,status:'completed',revision:3};
 const done=await client(base,riderPath);
 assert.equal(done.status,200);
 assert.equal(done.body.event.acceptedDriver,null);
 assert.equal(done.body.event.tracking,null);
});

test('HTTP: authenticated passenger request and driver lifecycle commands persist through gateway',async t=>{
 const {state,server}=fixture(),base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 const request=await client(base,'/v1/staging/rider/trips/request',{
  method:'POST',id:riderId,body:{requestKey:keyA,originTag:'PANTEON',
   destinationTag:'SHOPPING',service:'economico'}
 });
 assert.equal(request.status,201);
 assert.equal(request.body.tripId,tripId);
 assert.equal(request.body.serverPersisted,true);
 assert.equal((await client(base,'/v1/staging/rider/trips/request',{
  method:'POST',id:driverA,body:{requestKey:keyA,originTag:'PANTEON',
   destinationTag:'SHOPPING',service:'economico'}
 })).status,403);
 assert.equal((await client(base,'/v1/staging/driver/offers/accept',{
  method:'POST',id:driverA,body:{offerId:offerA,requestKey:keyA}
 })).status,200);
 const transitions=[
  ['arrive','cccc0000-0000-4000-8000-000000000003','arriving'],
  ['pickup','dddd0000-0000-4000-8000-000000000004','in_progress'],
  ['complete','eeee0000-0000-4000-8000-000000000005','completed'],
 ];
 for(const [event,eventKey,status] of transitions){
  const result=await client(base,`/v1/staging/trips/${tripId}/transition`,{
   method:'POST',id:driverA,body:{event,eventKey}
  });
  assert.equal(result.status,200);
  assert.equal(result.body.event,event);
  assert.equal(result.body.serverPersisted,true);
  assert.equal(state.trip.status,status);
 }
 const done=await client(base,riderPath);
 assert.equal(done.status,200);
 assert.equal(done.body.event.status,'completed');
 assert.equal(done.body.event.acceptedDriver,null);
 assert.equal(done.body.event.tracking,null);
});

test('HTTP: authenticated delivery request, courier custody and participant status',async t=>{
 const {state,server}=fixture(),base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 const request=await client(base,'/v1/staging/sender/deliveries/request',{
  method:'POST',id:riderId,body:{requestKey:keyA,vehicleKind:'AUTO',
   category:'GROCERIES',grams:12000,lengthCm:60,widthCm:40,heightCm:30,
   pickupTag:'SUPERMARKET_A',deliveryTag:'CUSTOMER_A',restrictedItemDeclared:false}
 });
 assert.equal(request.status,201);
 assert.equal(request.body.deliveryId,deliveryId);
 assert.equal(request.body.liveDeliveriesEnabled,false);
 const accept=await client(base,'/v1/staging/courier/delivery-offers/accept',{
  method:'POST',id:driverA,body:{offerId:offerA,requestKey:keyB}
 });
 assert.equal(accept.status,200);
 for(const [event,eventKey,extra,status] of [
  ['pickup','cccc0000-0000-4000-8000-000000000011',{},'picked_up'],
  ['deliver','cccc0000-0000-4000-8000-000000000012',
   {proofRef:deliveryProof},'delivered'],
 ]){
  const out=await client(base,`/v1/staging/deliveries/${deliveryId}/transition`,{
   method:'POST',id:driverA,body:{event,eventKey,...extra}
  });
  assert.equal(out.status,200);
  assert.equal(state.delivery.status,status);
 }
 const own=await client(base,`/v1/staging/deliveries/${deliveryId}/status`,{id:riderId});
 assert.equal(own.status,200);
 assert.equal(own.body.delivery.proofRef,deliveryProof);
 assert.equal((await client(base,`/v1/staging/deliveries/${deliveryId}/status`,
  {id:outsider})).status,403);
});

test('HTTP: malformed bodies, CORS origins, cookie sessions and URL confusion denied',async t=>{
 const {server}=fixture(),base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 const paths=[
  riderPath+'?passengerId='+outsider,
  '/v1/staging/driver/offers/%61ccept',
  '//v1/staging/driver/offers/accept',
  '/v1/staging/driver/offers/accept?extra=1'
 ];
 for(const path of paths){
  assert.equal((await client(base,path)).status,404);
 }
 assert.equal((await client(base,riderPath,{headers:{Origin:'https://malicious.example'}})).status,403);
 assert.equal((await client(base,riderPath,{headers:{Cookie:'session=evil'}})).status,403);
 const noJson=await fetch(base+'/v1/staging/driver/offers/accept',{
  method:'POST',headers:{...auth(driverA),'content-type':'text/plain'},
  body:'hello'
 });
 assert.equal(noJson.status,415);
 const invalid=await fetch(base+'/v1/staging/driver/offers/accept',{
  method:'POST',headers:{...auth(driverA),'content-type':'application/json'},
  body:'{invalid'
 });
 assert.equal(invalid.status,400);
 const malicious=await client(base,'/v1/staging/driver/offers/accept',{
  method:'POST',id:driverA,body:{
   offerId:offerA,requestKey:keyA,driverId:driverB
  }
 });
 assert.equal(malicious.status,400);
 const oversized=await fetch(base+'/v1/staging/driver/offers/accept',{
  method:'POST',headers:{...auth(driverA),'content-type':'application/json'},
  body:JSON.stringify({junk:'x'.repeat(4_096)})
 });
 assert.equal(oversized.status,413);
 assert.equal((await client(base,riderPath,{headers:{authorization:'bad'}})).status,401);
});
test('HTTP: listener rejects public/privileged ports; adapters cannot be missing',async()=>{
 assert.throws(()=>createQoreRadarLoopbackTransport({offerHandler:async()=>({})}));
 const {server}=fixture();
 assert.throws(()=>server.listen(0,'0.0.0.0'));
 assert.throws(()=>server.listen(4141,'::'));
 assert.throws(()=>server.listen(0));
 assert.throws(()=>server.listen({port:0,host:'127.0.0.1'}));
 await assert.rejects(listenQoreRadarLoopback(server,80));
 assert.equal(server.listening,false);
});

test('HTTP: G8 safety routes remain loopback-only and reach only safety gateway',async t=>{
 const calls=[];
 const unused=async()=>({status:404,body:{error:'Not found'}});
 const server=createQoreRadarLoopbackTransport({riderHandler:unused,
  offerHandler:unused,tripCommandHandler:unused,deliveryHandler:unused,
  merchantHandler:unused,financeHandler:unused,safetyHandler:async input=>{
   calls.push(input);return {status:201,body:{incidentId:deliveryId,
    externalResponseDispatched:false}};
  },merchantManagementHandler:unused,deliveryOfferHandler:unused});
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const response=await fetch(base+'/v1/staging/safety/incidents/report',{method:'POST',
  headers:{authorization:'Bearer synthetic_safety_fixture_never_real_12345',
   'content-type':'application/json'},body:JSON.stringify({requestKey:keyA})});
 assert.equal(response.status,201);
 assert.equal((await response.json()).externalResponseDispatched,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].path,'/v1/staging/safety/incidents/report');
});

test('HTTP: G9 merchant management route reaches only management gateway',async t=>{
 const calls=[];const unused=async()=>({status:404,body:{error:'Not found'}});
 const server=createQoreRadarLoopbackTransport({riderHandler:unused,
  offerHandler:unused,tripCommandHandler:unused,deliveryHandler:unused,
  merchantHandler:unused,financeHandler:unused,safetyHandler:unused,
  merchantManagementHandler:async input=>{calls.push(input);return {status:202,
   body:{merchantId:deliveryId,status:'pending'}};},deliveryOfferHandler:unused});
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const response=await fetch(base+'/v1/staging/merchant/onboarding/request',{method:'POST',
  headers:{authorization:'Bearer synthetic_merchant_fixture_never_real_12345',
   'content-type':'application/json'},body:JSON.stringify({requestKey:keyA})});
 assert.equal(response.status,202);assert.equal((await response.json()).status,'pending');
 assert.equal(calls.length,1);assert.equal(calls[0].path,
  '/v1/staging/merchant/onboarding/request');
});

test('HTTP: G10 delivery offer routes reach only recipient offer gateway',async t=>{
 const calls=[];const unused=async()=>({status:404,body:{error:'Not found'}});
 const server=createQoreRadarLoopbackTransport({riderHandler:unused,
  offerHandler:unused,tripCommandHandler:unused,deliveryHandler:unused,
  merchantHandler:unused,financeHandler:unused,safetyHandler:unused,
  merchantManagementHandler:unused,deliveryOfferHandler:async input=>{
   calls.push(input);return {status:200,body:{offerId:offerA,
    confirmedAcceptance:false}};
  }});
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const response=await fetch(base+'/v1/staging/courier/delivery-offers/'+offerA,{
  headers:auth(driverA)});
 assert.equal(response.status,200);
 assert.equal((await response.json()).confirmedAcceptance,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].path,'/v1/staging/courier/delivery-offers/'+offerA);
});

test('G25 HTTP: passenger cancellation is bound to JWT, atomic state and cannot set fees',async t=>{
 const {state,server}=fixture(),base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 const path='/v1/staging/rider/trips/'+tripId+'/cancel';
 assert.equal((await client(base,path,{id:driverA,method:'POST',
  body:{requestKey:keyA}})).status,403);
 assert.equal((await client(base,path,{id:riderId,method:'POST',
  body:{requestKey:keyA,amountGs:0}})).status,400);
 const result=await client(base,path,{id:riderId,method:'POST',
  body:{requestKey:keyA}});
 assert.equal(result.status,200);
 assert.equal(result.body.event,'cancel');
 assert.equal(result.body.commercialRidesEnabled,false);
 assert.equal(state.trip.status,'cancelled');
 const old=await client(base,path,{id:riderId,method:'POST',
  body:{requestKey:keyB}});
 assert.equal(old.status,409);
 assert.equal((await client(base,riderPath)).body.state,'cancelled');
 assert.equal((await client(base,path+'?actorId='+driverA,{id:riderId,
  method:'POST',body:{requestKey:keyA}})).status,404);
});

test('G75 F1 Admin audit: loopback refuses missing IdP MFA and routes read-only to verified handler',async t=>{
 const unused=async()=>({status:404,body:{error:'Not found'}});
 const required={riderHandler:unused,offerHandler:unused,
  tripCommandHandler:unused,deliveryHandler:unused,merchantHandler:unused,
  financeHandler:unused,safetyHandler:unused,
  merchantManagementHandler:unused,deliveryOfferHandler:unused};
 const path='/v1/staging/admin/rides/'+tripId+'/f1-verification';
 const closed=createQoreRadarLoopbackTransport(required);
 const local=await listenQoreRadarLoopback(closed);
 t.after(()=>close(closed));
 const blocked=await fetch(local+path,{headers:auth(outsider)});
 assert.equal(blocked.status,503,'no independent AAL2 provider means no Admin proof');
 let calls=0;
 const permitted=createQoreRadarLoopbackTransport({...required,
  adminF1AuditHandler:async request=>{
   calls++;
   assert.equal(request.method,'GET');
   assert.equal(request.path,path);
   assert.equal(request.body,undefined);
   return {status:200,body:{qaOnly:true,productionEnabled:false}};
  }});
 const testBase=await listenQoreRadarLoopback(permitted);
 t.after(()=>close(permitted));
 const dto=await fetch(testBase+path,{headers:auth(outsider)});
 assert.equal(dto.status,200);
 assert.equal((await dto.json()).productionEnabled,false);
 assert.equal(calls,1);
 assert.equal((await fetch(testBase+path,{method:'POST',headers:auth(outsider)})).status,404);
 assert.equal((await fetch(testBase+path,{
  headers:{...auth(outsider),Origin:'https://malicious.invalid'}})).status,403);
 assert.equal(calls,1);
});
