import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const t=1800000000000;
const id=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const passenger=id(1),stranger=id(2),routeId=id(3),quoteId=id(4);
const quoteKey=id(5),bookingKey=id(6),tripId=id(7);
const quote=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:passenger,routeId,quoteId,quoteRequestKey:quoteKey,
 fareMode:'AUTO',service:'economico',currency:'PYG',amountGs:19000,
 fareVersion:'qa-g72-v1',expiresAt:t+120000,
 serverPriced:true,routingVerified:true,status:'QUOTED_QA'});
const booking=(p={})=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:passenger,requestKey:bookingKey,quoteId,routeId,tripId,
 revision:1,serverPersisted:true,status:'ACCEPTED_QA',...p});
const status=(p={})=>({tripId,ownerId:passenger,revision:1,state:'searching',
 assignmentPersisted:false,driver:null,vehicle:null,gpsConsent:false,
 location:null,etaVerified:false,etaMinutes:null,
 mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
 event:{source:'server',tripId,passengerId:passenger,serverRevision:1,
 trackingSequence:0,status:'searching',acceptedDriver:null,tracking:null},
 locationVisible:false,deliveryConfirmed:false,...p});
const http=(body,code=200)=>({ok:code>=200&&code<300,status:code,
 redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(body)});
function setup({statusEnabled=true,quoteReply=null,bookReply=null,statusReply=null,
 readBack=null}={}){
 let actor={role:'passenger',subject:passenger,
  token:'synthetic-f1-passenger-token-abcdefghijklmnopqrstuvwxyz',expiresAt:t+3600000};
 let quotes=0,posts=0,gets=0,reconciles=0;
 const c=createClientExperience({now:()=>t,
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  autoPrequoteOptions:{
   enabled:true,quoteContractCertified:true,bookingContractCertified:true,
   reconciliationContractCertified:true,stagingRuntimeVerified:true,
   quoteGateway:async()=>{quotes++;return quoteReply?quoteReply():{ok:true,status:200,data:quote()};},
   bookingGateway:async scope=>{
    posts++;assert.equal(scope.routeId,routeId);
    assert.equal(scope.quoteId,quoteId);assert.equal(scope.requestKey,bookingKey);
    assert.equal(scope.amountGs,undefined);
    return bookReply?bookReply():{ok:true,status:201,data:booking()};
   },
   reconciliationGateway:async scope=>{
    reconciles++;assert.equal(scope.requestKey,bookingKey);
    assert.equal(scope.ownerId,passenger);assert.equal(scope.routeId,routeId);
    return readBack?readBack():{ok:true,status:200,data:booking()};
   }
  },
  statusGatewayOptions:{
   enabled:statusEnabled,contractCertified:true,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,request)=>{
    gets++;assert.equal(request.method,'GET');
    assert(url.endsWith('/rider/trips/'+tripId+'/status'));
    return statusReply?statusReply():http(status());
   }
  }
 });
 return {c,quotes:()=>quotes,posts:()=>posts,gets:()=>gets,
  reconciles:()=>reconciles,rotate:identity=>{actor=identity;},
  current:()=>actor};
}
async function book(f){
 const c=f.c;
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(c.prepareAutoPrequote({ownerId:passenger,
  routeId,quoteRequestKey:quoteKey,service:'economico',
  sessionRevision:c.snapshot().privateViewRevision}).ok,true);
 assert.equal((await c.loadAutoPrequote()).ok,true);
 assert.equal(c.acceptAutoPrequote({quoteId,amountGs:19000,
  fareVersion:'qa-g72-v1'}).ok,true);
 return c.reserveQuotedAuto({requestKey:bookingKey});
}
test('F1 quote PYG→explicit accept→one booking→own server GET→tracking; no Driver or payment inferred',async()=>{
 const f=setup();
 assert.equal((await book(f)).ok,true);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,true);
 assert.equal(f.c.snapshot().rideContinuation.tripId,tripId);
 assert.equal(f.gets(),0,'the booking ACK cannot start tracking on its own');
 assert.equal((await f.c.continueVerifiedRide()).ok,true);
 const snap=f.c.snapshot();
 assert.equal(snap.tracking.tripId,tripId);
 assert.equal(snap.tracking.state,'searching');
 assert.equal(snap.tracking.assignedDriver,null);
 assert.equal(snap.quote,null);
 assert.equal(snap.rideContinuation.productionEnabled,false);
 assert.equal(snap.autoPrequote.productionEnabled,false);
 assert.equal(f.posts(),1);assert.equal(f.quotes(),1);assert.equal(f.gets(),1);
 assert.equal(JSON.stringify(snap).includes(f.current().token),false);
});
test('F1 SQL-only quote and booking do not unlock status without independently certified HTTP read',async()=>{
 const f=setup({statusEnabled:false});
 assert.equal((await book(f)).ok,true);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.gets(),0);
});
test('F1 malformed ACK 201 cannot create proof or read Driver status',async()=>{
 const f=setup({bookReply:()=>({ok:true,status:201,
  data:{...booking(),routeId:stranger}})});
 assert.equal((await book(f)).code,'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.gets(),0);assert.equal(f.posts(),1);
});
test('F1 lost ACK recovered by own read only; no second POST before verified tracking',async()=>{
 const f=setup({bookReply:()=>({ok:false,status:503})});
 assert.equal((await book(f)).code,'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.reconcileQuotedAuto()).recoveredWithoutPost,true);
 assert.equal(f.c.snapshot().rideContinuation.tripId,tripId);
 assert.equal((await f.c.continueVerifiedRide()).ok,true);
 assert.equal(f.posts(),1);assert.equal(f.reconciles(),1);assert.equal(f.gets(),1);
});
test('F1 unknown readback keeps uncertain booking locked and must not start tracking',async()=>{
 const f=setup({bookReply:()=>({ok:false,status:503}),
  readBack:()=>({ok:false,status:404})});
 assert.equal((await book(f)).ok,false);
 assert.equal((await f.c.reconcileQuotedAuto()).code,'BOOKING_STILL_UNCONFIRMED');
 assert.equal(f.c.snapshot().autoPrequote.requiresReconciliation,true);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal(f.gets(),0);assert.equal(f.posts(),1);
});
test('F1 invalid cross-owner or unavailable GET refuses tracked trip despite strict booking receipt',async()=>{
 for(const reply of [()=>http(status({ownerId:stranger})),
  ()=>({ok:false,status:503,redirected:false})]){
  const f=setup({statusReply:reply});
  assert.equal((await book(f)).ok,true);
  assert.equal((await f.c.continueVerifiedRide()).ok,false);
  assert.equal(f.c.snapshot().tracking.subscriptionActive,false);
  assert.equal(f.c.snapshot().tracking.tripId,null);
  assert.equal(f.c.snapshot().tracking.assignedDriver,null);
  assert.equal(f.gets(),1);
 }
});
test('F1 status cannot regress below transactionally persisted booking revision',async()=>{
 const f=setup({bookReply:()=>({ok:true,status:201,data:booking({revision:5})})});
 assert.equal((await book(f)).ok,true);
 assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_STATUS_NOT_VERIFIED');
 assert.equal(f.c.snapshot().tracking.subscriptionActive,false);
 assert.equal(f.c.snapshot().tracking.tripId,null);
 assert.equal(f.gets(),1);
});
test('F1 JWT rotation erases quote-bound proof and rejects a stale tracking request',async()=>{
 const f=setup();
 assert.equal((await book(f)).ok,true);
 f.rotate({...f.current(),token:'rotated-qa-passenger-token-abcdefghijklmnopqrstuvwxyz'});
 assert.equal((await f.c.refreshSession()).ok,true);
 assert.equal(f.c.snapshot().autoPrequote.tripId,null);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.gets(),0);
});

test('A G72 local quote DTO cannot masquerade as certified route-attested B prequote',async()=>{
 const g72={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:passenger,
  quoteId,requestKey:quoteKey,fareMode:'AUTO',service:'economico',
  originTag:'PANTEON',destinationTag:'AEROPUERTO',zoneTag:'ASUNCION_FIXTURE',
  amountGs:19000,subtotalGs:19000,commissionGs:1900,providerGs:17100,
  fareVersion:'g72-qa-auto-v1',expiresAt:new Date(t+120000).toISOString(),
  serverPriced:true,serverPersisted:true,bookingId:null};
 const f=setup({quoteReply:()=>({ok:true,status:201,data:g72})});
 await f.c.refreshSession();
 const prep=f.c.prepareAutoPrequote({ownerId:passenger,routeId,
  quoteRequestKey:quoteKey,service:'economico',
  sessionRevision:f.c.snapshot().privateViewRevision});
 assert.equal(prep.ok,true);
 assert.equal((await f.c.loadAutoPrequote()).code,'PREQUOTE_NOT_VERIFIED');
 assert.equal(f.c.snapshot().autoPrequote.quote,null);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal(f.posts(),0);assert.equal(f.gets(),0);
});
test('A G72 old nine-field SQL/HTTP receipt is not the strict quote-bound ten-field proof',async()=>{
 const aG72={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
  ownerId:passenger,requestKey:bookingKey,operation:'rideRequest',
  serviceId:tripId,revision:1,serverPersisted:true,status:'ACCEPTED_QA'};
 const f=setup({bookReply:()=>({ok:true,status:201,data:aG72})});
 assert.equal((await book(f)).code,'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(f.c.snapshot().autoPrequote.tripId,null);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.posts(),1);assert.equal(f.gets(),0);
});
