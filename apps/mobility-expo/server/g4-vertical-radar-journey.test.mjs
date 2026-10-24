/**
 * Integrates 3 mocked actors across server-only QORE Radar offer + rider APIs.
 * NO database writes, no real phones, no Google, no push network, NO LIVE.
 * SQL double-acceptance races are separately certified in PostgreSQL 16 CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreOfferGateway} from './g4-offer-gateway.mjs';
import {createQoreRiderStatusGateway} from './g4-rider-status-gateway.mjs';
import {makePrivateDriverPush} from './g4-qore-radar-core.mjs';
import {createExpoPrivateOfferSender} from './g4-expo-push-offers.mjs';

const ref='staging1234567890abcd',passenger='11111111-1111-4111-8111-111111111111';
const driverA='22222222-2222-4222-8222-222222222222';
const driverB='33333333-3333-4333-8333-333333333333';
const outsider='44444444-4444-4444-8444-444444444444';
const tripId='55555555-5555-4555-8555-555555555555';
const offerA='66666666-6666-4666-8666-666666666666';
const offerB='77777777-7777-4777-8777-777777777777';
const vehicleA='88888888-8888-4888-8888-888888888888';
const vehicleB='99999999-9999-4999-8999-999999999999';
const keyA='aaaa0000-0000-4000-8000-000000000001';
const keyB='bbbb0000-0000-4000-8000-000000000002';
const clock={now:200_000};
const token=(id)=>('tok'+id.replaceAll('-','')).repeat(2);
const header=(id)=>({authorization:'Bearer '+token(id)});
const passengerRequest=()=>({
 method:'GET',path:'/v1/staging/rider/trips/'+tripId+'/status',headers:header(passenger)
});
const decisionRequest=(id,offerId,key)=>({
 method:'POST',path:'/v1/staging/driver/offers/accept',headers:header(id),
 body:{offerId,requestKey:key}
});
function scenario(){
 const state={
  trip:{id:tripId,passengerId:passenger,driverId:null,vehicleId:null,
   status:'searching',revision:1,trackingSequence:0},
  offers:new Map([[offerA,{id:offerA,driverId:driverA,vehicleId:vehicleA,status:'offered'}],
                  [offerB,{id:offerB,driverId:driverB,vehicleId:vehicleB,status:'offered'}]]),
  dbDecisions:0,pushSent:0,
 };
 const identify=async jwt=>{
  const user=[passenger,driverA,driverB,outsider].find(id=>token(id)===jwt);
  if(!user)throw Error('Fake invalid JWT');
  return {id:user,email_confirmed_at:'2026-10-17T10:00:00Z',is_anonymous:false};
 };
 const rider=createQoreRiderStatusGateway({
  projectRef:ref,now:()=>clock.now,verifyAccessToken:identify,
  authorizePassenger:async id=>id===passenger,
  allowRequest:()=>true,
  loadOwnTrip:async({tripId:id,passengerId:owner})=>
   id===tripId&&owner===passenger?{...state.trip}:null,
  loadArrivalEvidence:async({driverId,vehicleId})=>{
   if(driverId!==state.trip.driverId||vehicleId!==state.trip.vehicleId)
    throw Error('Not the assigned driver');
   return {
    driverProfile:{
     driverId,vehicleId,verifiedForDisplay:true,displayName:'Conductor de Prueba',
     vehicleKind:'AUTO',vehicleModel:'Toyota Vitz',color:'gris',
     plate:'TEST777',rating:4.8
    },
    location:{lat:-25.3,lng:-57.6,available:true,consentGranted:true,
     capturedAtMs:clock.now-2_000,accuracyMeters:18},
    route:{driverId,provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,
     fallbackUsed:false,calculatedAtMs:clock.now-1_000,
     roadMeters:1900,etaSeconds:300}
   };
  },
 });
 const driver=createQoreOfferGateway({
  projectRef:ref,now:()=>clock.now,verifyAccessToken:identify,
  authorizeDriver:async id=>id===driverA||id===driverB,
  allowRequest:()=>true,
  loadOfferForDriver:async({offerId,driverId})=>{
   const o=state.offers.get(offerId);
   return o&&o.driverId===driverId?{
    offerId:o.id,driverId:o.driverId,tripId,status:o.status,
    expiresAtMs:clock.now+15_000,service:'economico',
    originTag:'PANTEON',destinationTag:'SHOPPING'
   }:null;
  },
  acceptOffer:async({_offer_id,_driver_id,_decision_key})=>{
   const o=state.offers.get(_offer_id);
   if(!o||o.driverId!==_driver_id||o.status!=='offered'||
     state.trip.status!=='searching')throw Error('Ineligible offer');
   state.dbDecisions++;
   state.trip={...state.trip,driverId:_driver_id,vehicleId:o.vehicleId,
    status:'accepted',revision:state.trip.revision+1,trackingSequence:1};
   o.status='accepted';
   for(const other of state.offers.values())
    if(other.id!==o.id)other.status='withdrawn';
   return _decision_key;
  },
  declineOffer:async()=>{throw Error('Unused')},
 });
 return {state,driver,rider};
}
test('SYNTHETIC full passenger+two-drivers: search -> private push -> one accept -> real-ETA contract',async()=>{
 clock.now=200_000;
 const {state,driver,rider}=scenario();
 const prior=await rider(passengerRequest());
 assert.equal(prior.status,200);
 assert.equal(prior.body.event.status,'searching');
 assert.equal(prior.body.event.acceptedDriver,null);
 const offer=makePrivateDriverPush({
  rideId:tripId,offerId:offerA,driverId:driverA,
  expiresAtMs:clock.now+15_000,nowMs:clock.now
 });
 const send=createExpoPrivateOfferSender({
  now:()=>clock.now,request:async()=>{state.pushSent++;return{
   ok:true,json:async()=>({data:{status:'ok',id:'fake_ticket_12345'}})
  }}
 });
 const sent=await send({
  token:'ExponentPushToken[ABCDEFGHIJKLMNOP12345678]',
  verifiedDriverId:driverA,offer
 });
 assert.equal(sent.acceptedForProcessing,true);
 assert.equal(sent.delivered,false);
 const notYet=await rider(passengerRequest());
 assert.equal(notYet.body.event.acceptedDriver,null,'Push is not acceptance');
 const wrongOffer=await driver({
  method:'GET',path:'/v1/staging/driver/offers/'+offerA,headers:header(driverB)
 });
 assert.equal(wrongOffer.status,404);
 const privatePreview=await driver({
  method:'GET',path:'/v1/staging/driver/offers/'+offerA,headers:header(driverA)
 });
 assert.equal(privatePreview.status,200);
 assert.equal(privatePreview.body.confirmedAcceptance,false);
 const accepts=await Promise.all([
  driver(decisionRequest(driverA,offerA,keyA)),
  driver(decisionRequest(driverB,offerB,keyB))
 ]);
 assert.deepEqual(accepts.map(x=>x.status).sort(),[200,409]);
 assert.equal(state.dbDecisions,1);
 assert.equal(state.offers.get(offerB).status,'withdrawn');
 const winner=await rider(passengerRequest());
 assert.equal(winner.status,200);
 assert.equal(winner.body.event.status,'accepted');
 assert.equal(winner.body.event.acceptedDriver.plate,'TEST777');
 assert.equal(winner.body.event.tracking.roadMeters,1900);
 assert.equal(winner.body.event.tracking.etaSeconds,300);
 assert.equal(winner.body.locationVisible,true);
 assert.equal(winner.body.deliveryConfirmed,false);
 assert.equal(winner.body.commercialRidesEnabled,false);
 const strangerResult=await rider({
  method:'GET',path:'/v1/staging/rider/trips/'+tripId+'/status',
  headers:header(outsider)
 });
 assert.equal(strangerResult.status,403);
 assert.doesNotMatch(JSON.stringify(strangerResult),/TEST777|Conductor de Prueba|-25.3/);
 state.trip={...state.trip,status:'completed',revision:3};
 const terminal=await rider(passengerRequest());
 assert.equal(terminal.body.event.acceptedDriver,null);
 assert.equal(terminal.body.event.tracking,null);
 assert.equal(state.pushSent,1);
});
test('SYNTHETIC accepted driver position invalidated by GPS outage rather than freezing ETA',async()=>{
 clock.now=200_000;
 const {state,rider,driver}=scenario();
 assert.equal((await driver(decisionRequest(driverA,offerA,keyA))).status,200);
 const first=await rider(passengerRequest());
 assert.equal(first.body.locationVisible,true);
 // Forced stale timestamp scenario uses the same test backing object and
 // deliberately forbids a client-side fabricated countdown.
 clock.now=235_500;
 const evidenceExpired=createQoreRiderStatusGateway({
  projectRef:ref,verifyAccessToken:async()=>({
   id:passenger,email_confirmed_at:'now',is_anonymous:false
  }),
  authorizePassenger:async()=>true,allowRequest:()=>true,now:()=>clock.now,
  loadOwnTrip:async()=>state.trip,
  loadArrivalEvidence:async()=>({
   driverProfile:{driverId:driverA,vehicleId:vehicleA,
    verifiedForDisplay:true,displayName:'Conductor de Prueba',vehicleKind:'AUTO',
    vehicleModel:'Toyota Vitz',plate:'TEST777',rating:4.8},
   location:{lat:-25.3,lng:-57.6,consentGranted:true,available:true,
    capturedAtMs:200_000,accuracyMeters:20},
   route:{driverId:driverA,provider:'VERIFIED_ROAD_ROUTER',
    trafficAware:true,fallbackUsed:false,calculatedAtMs:200_000,
    roadMeters:1900,etaSeconds:300}
  })
 });
 const stale=await evidenceExpired(passengerRequest());
 assert.equal(stale.status,200);
 assert.equal(stale.body.event.acceptedDriver.plate,'TEST777');
 assert.equal(stale.body.event.tracking,null);
 assert.equal(stale.body.locationVisible,false);
});
