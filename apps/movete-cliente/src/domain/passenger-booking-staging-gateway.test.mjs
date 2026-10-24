import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassengerBookingStagingGateway} from './passenger-booking-staging-gateway.mjs';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const subject=id(1),trip=id(3),delivery=id(4),key=id(5);
const token='qa-passenger-token-with-enough-length';
const identity=()=>({role:'passenger',subject,token,authRevision:4,
 sessionRevision:9,expiresAt:T+120000});
const ride=()=>({requestKey:key,originTag:'San Lorenzo centro',
 destinationTag:'Villa Morra Asuncion',service:'economico'});
const shipment=()=>({requestKey:key,vehicleKind:'MOTO',
 category:'PARCEL',grams:2000,lengthCm:20,widthCm:10,heightCm:5,
 pickupTag:'San Lorenzo centro',deliveryTag:'Asuncion centro',
 restrictedItemDeclared:false});
const receipt=(operation='rideRequest',override={})=>({
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:subject,
 requestKey:key,operation,serviceId:operation==='rideRequest'?trip:delivery,
 revision:1,serverPersisted:true,status:'ACCEPTED_QA',...override
});
const response=(x=receipt(),status=201)=>({status,ok:status===201,redirected:false,
 headers:{get:h=>h==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(x)});
const base=()=>({enabled:true,contractCertified:true,
 stagingRuntimeVerified:true,qaReceiptContractCertified:true,
 origin:'https://qa.staging.example.invalid',
 pinnedOrigin:'https://qa.staging.example.invalid',
 getSession:async()=>identity(),fetchImpl:async()=>response(),
 now:()=>T,timeoutMs:4500});
const send=(g,body=ride(),operation='rideRequest')=>
 g.send(operation,{body,expectedSessionRevision:9});

test('R56 refuses all bookings by default, with zero network calls',async()=>{
 let n=0;
 const g=createPassengerBookingStagingGateway({fetchImpl:async()=>{n++}});
 assert.equal(g.isConfigured(),false);assert.equal(g.productionEnabled,false);
 assert.equal((await send(g)).code,'BOOKING_STAGING_NOT_CERTIFIED');
 assert.equal(n,0);
});
test('R56 all four independent gates are required for booking transport',async()=>{
 let n=0;
 for(const field of ['enabled','contractCertified','stagingRuntimeVerified',
  'qaReceiptContractCertified']){
  const g=createPassengerBookingStagingGateway({...base(),[field]:false,
   fetchImpl:async()=>{n++;return response();}});
  assert.equal(g.isConfigured(),false);
  assert.equal((await send(g)).ok,false);
 }
 assert.equal(n,0);
});
test('R56 rejects unpinned, HTTP and path/port-injected endpoints',()=>{
 for(const bad of ['http://qa.staging.example.invalid',
  'https://other.staging.example.invalid',
  'https://qa.staging.example.invalid/v1',
  'https://qa.staging.example.invalid:8080',
  'https://admin@qa.staging.example.invalid']){
  const g=createPassengerBookingStagingGateway({...base(),origin:bad});
  assert.equal(g.isConfigured(),false);
 }
});
test('R56 accepts exact persisted QA-only ride receipt without dispatch claim',async()=>{
 const calls=[];
 const g=createPassengerBookingStagingGateway({...base(),
  fetchImpl:async(url,req)=>{calls.push({url,req});return response();}});
 const r=await send(g);
 assert.equal(r.ok,true);assert.equal(r.qaOnly,true);
 assert.equal(r.commercialEnabled,false);
 assert.equal(r.bookingConfirmedForProduction,false);
 assert.equal(r.data.serviceId,trip);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://qa.staging.example.invalid/v1/staging/rider/trips/request');
 assert.deepEqual(JSON.parse(calls[0].req.body),ride());
 assert.equal(calls[0].req.credentials,'omit');
 assert.equal(calls[0].req.redirect,'error');
 assert.equal(calls[0].req.cache,'no-store');
 assert.equal(calls[0].req.headers.Authorization,'Bearer '+token);
});
test('R56 independently allows delivery only with strict QA receipt',async()=>{
 let sent;
 const g=createPassengerBookingStagingGateway({...base(),
  fetchImpl:async(url,opts)=>{sent={url,opts};
   return response(receipt('deliveryRequest'));}});
 const r=await send(g,shipment(),'deliveryRequest');
 assert.equal(r.ok,true);assert.equal(r.data.serviceId,delivery);
 assert.equal(sent.url,
  'https://qa.staging.example.invalid/v1/staging/sender/deliveries/request');
 assert.equal(sent.opts.method,'POST');
});
test('R56 generic G11 HTTP 201 never becomes booked ride or shipment',async()=>{
 const g=createPassengerBookingStagingGateway({...base(),
  fetchImpl:async()=>response({tripId:trip})});
 assert.equal((await send(g)).code,'BOOKING_RECEIPT_NOT_CERTIFIED');
});
test('R56 rejects cross-user, changed request key, scope or fake persisted ACK',async()=>{
 for(const patch of [
  {ownerId:id(80)},{requestKey:id(99)},{operation:'deliveryRequest'},
  {serviceId:'not-uuid'},{status:'COMPLETED'},
  {serverPersisted:false},{commercialEnabled:true},{mode:'PRODUCTION'},
  {revision:0},{extra:'unexpected field'}
 ]){
  const g=createPassengerBookingStagingGateway({...base(),
   fetchImpl:async()=>response(receipt('rideRequest',patch))});
  assert.equal((await send(g)).code,'BOOKING_RECEIPT_NOT_CERTIFIED',
   JSON.stringify(patch));
 }
});
test('R56 cross-session or Driver role is denied before any POST',async()=>{
 let hits=0;
 for(const session of [
  {...identity(),role:'driver'},{...identity(),subject:id(22)},
  {...identity(),sessionRevision:10},{...identity(),expiresAt:T-1}
 ]){
  const g=createPassengerBookingStagingGateway({...base(),
   getSession:async()=>session,
   fetchImpl:async()=>{hits++;return response();}});
  assert.equal((await send(g)).ok,false);
 }
 assert.equal(hits,0);
});
test('R56 invalid operations or altered ride payload do not touch network',async()=>{
 let hits=0;
 const g=createPassengerBookingStagingGateway({...base(),
  fetchImpl:async()=>{hits++;return response();}});
 assert.equal((await send(g,ride(),'paymentAuthorize')).ok,false);
 assert.equal((await send(g,{...ride(),service:'MOTO'})).ok,false);
 assert.equal((await send(g,{...ride(),ownerId:subject})).ok,false);
 assert.equal(hits,0);
});
test('R56 late JWT rotation discards valid HTTP receipt',async()=>{
 let session=identity(),release;
 const delayed=new Promise(resolve=>release=resolve);
 const g=createPassengerBookingStagingGateway({...base(),
  getSession:async()=>session,fetchImpl:async()=>delayed});
 const task=send(g);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 session={...identity(),token:'rotated-qa-token-with-enough-length'};
 release(response());
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
});
test('R56 concurrent taps cannot send two independent requests',async()=>{
 let hits=0,release;
 const delayed=new Promise(resolve=>release=resolve);
 const g=createPassengerBookingStagingGateway({...base(),
  fetchImpl:async()=>{hits++;return delayed;}});
 const first=send(g);
 const second=await send(g);
 assert.equal(second.code,'BOOKING_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 release(response());
 assert.equal((await first).ok,true);
 assert.equal(hits,1);
});
test('R56 offline or unreadable receipt never confirms bookings',async()=>{
 for(const fetchImpl of [
  async()=>{throw Error('offline')},
  async()=>({...response(),text:async()=>'{invalid'}),
  async()=>({status:409,ok:false,redirected:false})
 ]){
  const g=createPassengerBookingStagingGateway({...base(),fetchImpl});
  assert.equal((await send(g)).ok,false);
 }
});
test('R56 ClientExperience defaults OFF and even configured 201 generic stays blocked',async()=>{
 const session=()=>({subject,role:'passenger',token,expiresAt:T+120000});
 const off=createClientExperience({now:()=>T,authProvider:{
  readSession:async()=>session(),signOut:async()=>{}
 }});
 assert.equal((await off.refreshSession()).ok,true);
 assert.equal(off.prepareRide(ride()).ok,true);
 assert.equal((await off.submit()).code,'GATEWAY_UNAVAILABLE');

 let calls=0;
 const client=createClientExperience({
  now:()=>T,authProvider:{readSession:async()=>session(),signOut:async()=>{}},
  bookingHttpOptions:{
   ...base(),fetchImpl:async()=>{calls++;return response({tripId:trip});}
  }
 });
 assert.equal((await client.refreshSession()).ok,true);
 assert.equal(client.prepareRide(ride()).ok,true);
 assert.equal((await client.submit()).code,'BOOKING_RECEIPT_NOT_CERTIFIED');
 assert.equal(client.snapshot().mutation.phase,'failed');
 assert.equal(client.snapshot().mutation.requestKey,key);
 assert.equal(client.prepareRide({...ride(),requestKey:id(8)}).code,
  'RECONCILE_BEFORE_NEW_REQUEST');
 assert.equal(calls,1);
});
test('R56 ClientExperience accepts QA receipt, but does not invent a Driver assignment',async()=>{
 const client=createClientExperience({
  now:()=>T,authProvider:{readSession:async()=>({
   subject,role:'passenger',token,expiresAt:T+120000
  }),signOut:async()=>{}},
  bookingHttpOptions:{...base(),fetchImpl:async()=>response()}
 });
 assert.equal((await client.refreshSession()).ok,true);
 assert.equal(client.prepareRide(ride()).ok,true);
 assert.equal((await client.submit()).ok,true);
 assert.equal(client.snapshot().mutation.phase,'acknowledged');
 assert.equal(client.snapshot().tracking.assignedDriver,null);
 assert.equal(client.snapshot().tracking.subscriptionActive,false);
 assert.equal(client.snapshot().quote,null);
});
