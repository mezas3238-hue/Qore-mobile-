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
 g.send(operation,{body,expectedSessionRevision:9,expectedSubject:subject});

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
test('R56 explicit expected subject is mandatory even for direct gateway calls',async()=>{
 let hits=0;
 const g=createPassengerBookingStagingGateway({...base(),
  fetchImpl:async()=>{hits++;return response();}});
 const omitted=await g.send('rideRequest',{body:ride(),expectedSessionRevision:9});
 assert.equal(omitted.code,'STALE_SESSION_RESPONSE');
 const foreign=await g.send('rideRequest',{
  body:ride(),expectedSessionRevision:9,expectedSubject:id(77)});
 assert.equal(foreign.code,'STALE_SESSION_RESPONSE');
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

test('R57 missing reconciliation contract cannot make a network READ',async()=>{
 let reads=0;
 const g=createPassengerBookingStagingGateway({...base(),
  reconciliationRead:async()=>{reads++;return {ok:false};}});
 assert.equal((await g.reconcile('rideRequest',{requestKey:key,
  expectedSessionRevision:9,expectedSubject:subject})).code,
  'BOOKING_RECONCILIATION_NOT_CERTIFIED');
 assert.equal(reads,0);
});
test('R57 reconciliation uses same passenger key and never sends a POST',async()=>{
 let reads=0,posts=0,scope;
 const g=createPassengerBookingStagingGateway({...base(),
  reconciliationContractCertified:true,
  fetchImpl:async()=>{posts++;throw Error('No POST is allowed in reconciliation');},
  reconciliationRead:async x=>{scope=x;reads++;return {
   ok:true,status:200,data:receipt()};}
 });
 const x=await g.reconcile('rideRequest',{requestKey:key,
  expectedSessionRevision:9,expectedSubject:subject});
 assert.equal(x.ok,true);assert.equal(x.recoveredWithoutPost,true);
 assert.equal(x.bookingConfirmedForProduction,false);
 assert.equal(reads,1);assert.equal(posts,0);
 assert.deepEqual(Object.keys(scope).sort(),
  ['operation','requestKey','expectedSubject','expectedSessionRevision','bearer'].sort());
 assert.equal(scope.bearer,token);assert.equal(scope.requestKey,key);
});
test('R57 404 NOT_YET_OBSERVED, empty or malformed read cannot unlock request',async()=>{
 for(const data of [
  {ok:false,status:404,code:'NOT_YET_OBSERVED'},
  {ok:true,status:200,data:null},
  {ok:true,status:200,data:receipt('rideRequest',{ownerId:id(88)})},
  {ok:true,status:200,data:receipt('rideRequest',{requestKey:id(89)})},
  {ok:true,status:201,data:receipt()},
  {ok:true,status:200,data:receipt('rideRequest',{serverPersisted:false})}
 ]){
  const g=createPassengerBookingStagingGateway({...base(),
   reconciliationContractCertified:true,reconciliationRead:async()=>data});
  const x=await g.reconcile('rideRequest',{requestKey:key,
   expectedSessionRevision:9,expectedSubject:subject});
  assert.equal(x.code,'BOOKING_RECONCILIATION_UNKNOWN');
 }
});
test('R57 read-only recovery denies another actor or revision before backend',async()=>{
 let hits=0;
 const g=createPassengerBookingStagingGateway({...base(),
  reconciliationContractCertified:true,
  reconciliationRead:async()=>{hits++;return {ok:true,status:200,data:receipt()};}});
 for(const patch of [
  {expectedSubject:id(88)},{expectedSubject:null},
  {expectedSessionRevision:10},{requestKey:'bad'}
 ]){
  const x=await g.reconcile('rideRequest',{
   requestKey:key,expectedSubject:subject,expectedSessionRevision:9,...patch
  });
  assert.equal(x.ok,false);
 }
 assert.equal(hits,0);
});
test('R57 JWT rotation while read is in flight never authorizes the old receipt',async()=>{
 let current=identity(),release,posted=0;
 const wait=new Promise(resolve=>{release=resolve;});
 const g=createPassengerBookingStagingGateway({...base(),
  getSession:async()=>current,
  reconciliationContractCertified:true,reconciliationRead:async()=>wait,
  fetchImpl:async()=>{posted++;throw Error('POST forbidden');}
 });
 const job=g.reconcile('rideRequest',{requestKey:key,
  expectedSessionRevision:9,expectedSubject:subject});
 await Promise.resolve();await Promise.resolve();
 current={...identity(),token:'rotated-passenger-token-1234567890'};
 release({ok:true,status:200,data:receipt()});
 assert.equal((await job).code,'STALE_SESSION_RESPONSE');
 assert.equal(posted,0);
});
test('R57 ClientExperience timeout blocks POST retry and new requestKey',async()=>{
 let posts=0;
 const client=createClientExperience({
  now:()=>T,authProvider:{readSession:async()=>({
   subject,role:'passenger',token,expiresAt:T+120000
  }),signOut:async()=>{}},
  bookingHttpOptions:{...base(),fetchImpl:async()=>{
   posts++;throw Error('response lost after possible commit');
  }}
 });
 await client.refreshSession();
 assert.equal(client.prepareRide(ride()).ok,true);
 assert.equal((await client.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(client.snapshot().mutation.phase,'failed');
 assert.equal((await client.retry()).code,'NO_READY_REQUEST');
 assert.equal(client.prepareRide({...ride(),requestKey:id(9)}).code,
  'RECONCILE_BEFORE_NEW_REQUEST');
 assert.equal((await client.reconcileBooking()).code,
  'BOOKING_RECONCILIATION_NOT_CERTIFIED');
 assert.equal(posts,1);
});
test('R57 certified read-only recovery updates prior request, no new POST',async()=>{
 let posts=0,reads=0;
 const client=createClientExperience({
  now:()=>T,authProvider:{readSession:async()=>({
   subject,role:'passenger',token,expiresAt:T+120000
  }),signOut:async()=>{}},
  bookingHttpOptions:{...base(),
   reconciliationContractCertified:true,
   reconciliationRead:async scope=>{reads++;
    assert.equal(scope.requestKey,key);assert.equal(scope.expectedSubject,subject);
    return {ok:true,status:200,data:receipt()};},
   fetchImpl:async()=>{posts++;return response({tripId:trip});}
  }
 });
 await client.refreshSession();
 client.prepareRide(ride());
 assert.equal((await client.submit()).code,'BOOKING_RECEIPT_NOT_CERTIFIED');
 assert.equal(client.snapshot().mutation.phase,'failed');
 const result=await client.reconcileBooking();
 assert.equal(result.ok,true);assert.equal(result.qaOnly,true);
 assert.equal(client.snapshot().mutation.phase,'acknowledged');
 assert.equal(client.snapshot().tracking.assignedDriver,null);
 assert.equal((await client.retry()).code,'NO_READY_REQUEST');
 assert.equal(posts,1);assert.equal(reads,1);
});
test('R57 an inconclusive read is not rollback permission',async()=>{
 let posts=0,reads=0;
 const client=createClientExperience({
  now:()=>T,authProvider:{readSession:async()=>({
   subject,role:'passenger',token,expiresAt:T+120000
  }),signOut:async()=>{}},
  bookingHttpOptions:{...base(),reconciliationContractCertified:true,
   reconciliationRead:async()=>{reads++;return {
    ok:false,status:404,code:'NOT_YET_OBSERVED'};},
   fetchImpl:async()=>{posts++;throw Error('unknown');}}
 });
 await client.refreshSession();
 client.prepareDelivery(shipment());
 assert.equal((await client.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal((await client.reconcileBooking()).code,
  'BOOKING_RECONCILIATION_UNKNOWN');
 assert.equal(client.snapshot().mutation.phase,'failed');
 assert.equal(client.prepareRide(ride()).code,'RECONCILE_BEFORE_NEW_REQUEST');
 assert.equal(posts,1);assert.equal(reads,1);
});
