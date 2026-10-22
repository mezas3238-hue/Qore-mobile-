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
 const server=createQoreRadarLoopbackTransport({
  riderHandler:rider,offerHandler:offer,tripCommandHandler:commands
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
