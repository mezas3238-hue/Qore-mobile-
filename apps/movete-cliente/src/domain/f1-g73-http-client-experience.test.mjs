import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const t=1900000000000,id=n=>'73730000-0000-4737-8737-'+String(n).padStart(12,'0');
const owner=id(1),routeId=id(2),quoteId=id(3),routeKey=id(4),bookKey=id(5),tripId=id(6);
const input={origin:'Panteón',destination:'Aeropuerto',service:'economico',
 quoteRequestKey:routeKey};
const reply=(data,status=200)=>({
 status,ok:status>=200&&status<300,redirected:false,
 headers:{get:name=>name==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)
});
const route=()=>({routeId,ownerId:owner,quoteRequestKey:routeKey,
 origin:input.origin,destination:input.destination,service:input.service,
 routingVerified:true,coverageVerified:true,expiresAt:t+300000,
 source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'});
const quote=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,routeId,quoteId,quoteRequestKey:routeKey,fareMode:'AUTO',
 service:'economico',currency:'PYG',amountGs:17500,fareVersion:'g73-qa-v1',
 expiresAt:t+120000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'});
const booked=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,requestKey:bookKey,quoteId,routeId,tripId,
 revision:1,serverPersisted:true,status:'ACCEPTED_QA'});
function build({runtime=true,failBooking=false,foreignQuote=false,
 dispatchState='RETRY_PENDING',tripState='searching',certifiedStatus=false}={}){
 let actor={role:'passenger',subject:owner,
  token:'signed-qa-jwt-not-real-abcdefghijklmnopqrst',expiresAt:t+600000};
 const calls=[];
 const experience=createClientExperience({
  now:()=>t,
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  statusGatewayOptions:certifiedStatus?{
   enabled:true,contractCertified:true,origin:'https://qa.example.invalid',
   pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async()=>reply({
    tripId,ownerId:owner,revision:2,state:'assigned',
    assignmentPersisted:true,driver:null,vehicle:null,gpsConsent:false,
    location:null,etaVerified:false,etaMinutes:null,mode:'STAGING_DEMO_ONLY',
    commercialRidesEnabled:false,
    event:{source:'server',tripId,passengerId:owner,serverRevision:2,
     trackingSequence:1,status:'accepted',acceptedDriver:null,tracking:null},
    locationVisible:false,deliveryConfirmed:false
   })
  }:null,
  autoG73HttpOptions:{
   enabled:runtime,contractCertified:true,stagingRuntimeVerified:true,
   routeProviderCertified:true,origin:'https://qa.example.invalid',
   pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,init)=>{
    const path=new URL(url).pathname;
    calls.push({path,method:init.method,body:init.body?JSON.parse(init.body):null});
    if(path.endsWith('/routes'))return reply(route());
    if(path.endsWith('/prequote'))return reply(foreignQuote
     ?{...quote(),ownerId:id(9)}:quote());
    if(path.endsWith('/dispatch'))return reply({
     mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
     bookingKey:bookKey,tripId,tripState,
     dispatchState,attempts:1,
     offerPendingAcceptance:dispatchState==='OFFER_PENDING'});
    if(path.endsWith('/book'))return failBooking?reply({error:'timeout after commit'},503)
     :reply(booked(),201);
    if(path.endsWith('/bookings/'+bookKey))return reply(booked(),200);
    throw Error('unexpected');
   }
  }
 });
 return {experience,calls,changeSession:value=>actor=value,session:()=>actor};
}
test('G73 no provider attestation means no route, quote or booking HTTP at all',async()=>{
 const f=build({runtime:false}),c=f.experience;
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(c.snapshot().autoRouteQuote.available,false);
 assert.equal((await c.requestAutoQuote(input)).code,'VERIFIED_ROUTE_CONTRACT_PENDING');
 assert.equal(f.calls.length,0);
});
test('G73 combined HTTP route→PYG→explicit consent→one POST; tracking still requires own status GET',async()=>{
 const f=build(),c=f.experience;
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(c.snapshot().autoRouteQuote.available,true);
 const q=await c.requestAutoQuote(input);
 assert.equal(q.ok,true);
 assert.equal(q.quote.amountGs,17500);
 assert.equal(c.snapshot().autoPrequote.quote.amountGs,17500);
 assert.equal(c.snapshot().rideContinuation.canVerify,false);
 const accept=c.acceptAutoPrequote({quoteId,amountGs:17500,fareVersion:'g73-qa-v1'});
 assert.equal(accept.ok,true);
 assert.equal((await c.reserveQuotedAuto({requestKey:bookKey})).ok,true);
 const snap=c.snapshot();
 assert.equal(snap.autoPrequote.phase,'confirmed');
 assert.equal(snap.autoPrequote.tripId,tripId);
 assert.equal(snap.rideContinuation.canVerify,false);
 assert.equal(snap.tracking.tripId,null);
 assert.equal(snap.tracking.assignedDriver,null);
 assert.equal(snap.quote,null);
 assert.equal(snap.autoPrequote.productionEnabled,false);
 assert.deepEqual(f.calls.map(x=>x.method),['POST','POST','POST']);
 assert.equal(f.calls[2].body.amountGs,undefined);
 assert.equal(f.calls[2].body.accepted,true);
 assert.equal(JSON.stringify(snap).includes(f.session().token),false);
});
test('G73 ambiguous POST 503: read-only GET reconciles same owner/key; never rebooks',async()=>{
 const f=build({failBooking:true}),c=f.experience;
 await c.refreshSession();
 assert.equal((await c.requestAutoQuote(input)).ok,true);
 c.acceptAutoPrequote({quoteId,amountGs:17500,fareVersion:'g73-qa-v1'});
 assert.equal((await c.reserveQuotedAuto({requestKey:bookKey})).code,
  'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(c.snapshot().autoPrequote.requiresReconciliation,true);
 assert.equal(c.snapshot().rideContinuation.canVerify,false);
 const result=await c.reconcileQuotedAuto();
 assert.equal(result.ok,true);
 assert.equal(result.recoveredWithoutPost,true);
 assert.equal(c.snapshot().autoPrequote.tripId,tripId);
 assert.deepEqual(f.calls.map(x=>x.method),['POST','POST','POST','GET']);
 assert.equal(f.calls[3].path.endsWith('/bookings/'+bookKey),true);
});
test('G73 malformed foreign quote cannot authorize fare, consent or POST',async()=>{
 const f=build({foreignQuote:true}),c=f.experience;
 await c.refreshSession();
 assert.equal((await c.requestAutoQuote(input)).ok,false);
 assert.equal(c.snapshot().autoPrequote.quote,null);
 assert.equal(c.snapshot().rideContinuation.canVerify,false);
 assert.equal(f.calls.length,2);
});
test('G73 JWT rotation clears the entire route/fare/booking chain',async()=>{
 const f=build(),c=f.experience;
 await c.refreshSession();
 assert.equal((await c.requestAutoQuote(input)).ok,true);
 f.changeSession({...f.session(),token:'rotated-synthetic-qa-jwt-abcdefghijklmnopq'});
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(c.snapshot().autoPrequote.quote,null);
 assert.equal(c.snapshot().autoPrequote.phase,'idle');
 assert.equal(c.snapshot().rideContinuation.canVerify,false);
 assert.equal(f.calls.length,2);
});

test('R67 actual Cliente reads G90 search status only after confirmed G73 booking, no duplicate POST',async()=>{
 const f=build(),c=f.experience;
 await c.refreshSession();
 assert.equal((await c.refreshAutoDispatch()).code,'DISPATCH_BOOKING_NOT_VERIFIED');
 assert.equal(c.snapshot().autoDispatch.readReady,false);
 assert.equal(f.calls.length,0);
 await c.requestAutoQuote(input);
 c.acceptAutoPrequote({quoteId,amountGs:17500,fareVersion:'g73-qa-v1'});
 assert.equal((await c.reserveQuotedAuto({requestKey:bookKey})).ok,true);
 assert.equal(c.snapshot().autoDispatch.readReady,true);
 const r=await c.refreshAutoDispatch();
 assert.equal(r.ok,true);
 const snap=c.snapshot().autoDispatch;
 assert.equal(snap.tripId,tripId);
 assert.equal(snap.dispatchState,'RETRY_PENDING');
 assert.equal(snap.attempts,1);
 assert.equal(snap.offerPendingAcceptance,false);
 assert.equal(snap.productionEnabled,false);
 assert.deepEqual(f.calls.map(x=>x.method),['POST','POST','POST','GET']);
 assert.equal(f.calls[3].path,'/v1/staging/rider/auto/bookings/'+bookKey+'/dispatch');
 assert.equal(f.calls[3].body,null);
 assert.equal(JSON.stringify(c.snapshot()).includes(f.session().token),false);
});
test('R67 rotated JWT revokes G90 private Driver search view',async()=>{
 const f=build(),c=f.experience;
 await c.refreshSession();
 await c.requestAutoQuote(input);
 c.acceptAutoPrequote({quoteId,amountGs:17500,fareVersion:'g73-qa-v1'});
 await c.reserveQuotedAuto({requestKey:bookKey});
 assert.equal((await c.refreshAutoDispatch()).ok,true);
 f.changeSession({...f.session(),token:'rotated-synthetic-qa-jwt-abcdefghijklmnopq'});
 await c.refreshSession();
 assert.equal(c.snapshot().autoDispatch.readReady,false);
 assert.equal(c.snapshot().autoDispatch.dispatchState,null);
 assert.equal((await c.refreshAutoDispatch()).code,'DISPATCH_BOOKING_NOT_VERIFIED');
});

test('R68 a CLOSED accepted dispatch requires owner G4 verification for tracking',async()=>{
 const f=build({dispatchState:'CLOSED',tripState:'accepted',certifiedStatus:true});
 const c=f.experience;
 await c.refreshSession();await c.requestAutoQuote(input);
 c.acceptAutoPrequote({quoteId,amountGs:17500,fareVersion:'g73-qa-v1'});
 assert.equal((await c.reserveQuotedAuto({requestKey:bookKey})).ok,true);
 assert.equal((await c.refreshAutoDispatch()).ok,true);
 assert.equal(c.snapshot().autoDispatch.needsRideVerification,true);
 assert.equal(c.snapshot().tracking.tripId,null);
 assert.equal(c.snapshot().tracking.assignedDriver,null);
 assert.equal((await c.continueVerifiedRide()).ok,true);
 assert.equal(c.snapshot().tracking.tripId,tripId);
 assert.equal(c.snapshot().tracking.state,'assigned');
 assert.equal(c.snapshot().autoDispatch.needsRideVerification,false);
 assert.equal(c.snapshot().tracking.assignedDriver,null);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/book')).length,1);
});
test('R68 CLOSED cancelled or no independent status contract never suggests assigned Driver',async()=>{
 for(const opts of [
  {dispatchState:'CLOSED',tripState:'cancelled',certifiedStatus:true},
  {dispatchState:'CLOSED',tripState:'accepted',certifiedStatus:false}
 ]){
  const f=build(opts),c=f.experience;
  await c.refreshSession();await c.requestAutoQuote(input);
  c.acceptAutoPrequote({quoteId,amountGs:17500,fareVersion:'g73-qa-v1'});
  await c.reserveQuotedAuto({requestKey:bookKey});
  assert.equal((await c.refreshAutoDispatch()).ok,true);
  assert.equal(c.snapshot().autoDispatch.needsRideVerification,false);
  assert.equal(c.snapshot().tracking.tripId,null);
  assert.equal(c.snapshot().tracking.assignedDriver,null);
 }
});
