import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

/**
 * G74 on the B consumer side: same synthetic persisted trip through A G73
 * route -> prequote -> booking -> independent G4 Passenger GET.
 * Distinct HTTPS requests, no imagined dispatch, route, Driver, GPS or LIVE.
 */
const t=1900000000000;
const id=n=>'74740000-0000-4747-8747-'+String(n).padStart(12,'0');
const passenger=id(1),foreign=id(2),routeId=id(3),quoteId=id(4),
 tripId=id(5),quoteKey=id(6),bookingKey=id(7);
const origin='https://qa.example.invalid';
const intent={origin:'Centro, Asunción',destination:'Aeropuerto, Asunción',
 service:'economico',quoteRequestKey:quoteKey};
const route=()=>({routeId,ownerId:passenger,quoteRequestKey:quoteKey,
 origin:intent.origin,destination:intent.destination,service:intent.service,
 routingVerified:true,coverageVerified:true,expiresAt:t+240000,
 source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'});
const quote=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:passenger,routeId,quoteId,quoteRequestKey:quoteKey,
 fareMode:'AUTO',service:'economico',currency:'PYG',amountGs:15200,
 fareVersion:'qa-g73-f1',expiresAt:t+120000,
 serverPriced:true,routingVerified:true,status:'QUOTED_QA'});
const receipt=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:passenger,requestKey:bookingKey,quoteId,routeId,tripId,
 revision:1,serverPersisted:true,status:'ACCEPTED_QA'});
const status=(patch={})=>({tripId,ownerId:passenger,revision:1,
 state:'searching',assignmentPersisted:false,driver:null,vehicle:null,
 gpsConsent:false,location:null,etaVerified:false,etaMinutes:null,
 mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
 event:{source:'server',tripId,passengerId:passenger,
  serverRevision:1,trackingSequence:0,status:'searching',
  acceptedDriver:null,tracking:null},
 locationVisible:false,deliveryConfirmed:false,...patch});
const response=(dto,code=200)=>({ok:code>=200&&code<300,status:code,
 redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(dto)});
function fixture({statusCertified=true,lostAck=false,statusOverride=null}={}){
 let identity={role:'passenger',subject:passenger,
  token:'g74-passenger-token-synthetic-abcdefghijklmnopqrstuvwxyz',
  expiresAt:t+3600000};
 let persisted=false;
 const reqs=[];
 const c=createClientExperience({
  now:()=>t,
  authProvider:{readSession:async()=>identity,signOut:async()=>{}},
  autoG73HttpOptions:{
   enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   routeProviderCertified:true,origin,pinnedOrigin:origin,
   fetchImpl:async(url,req)=>{
    const path=new URL(url).pathname;
    reqs.push({path,method:req.method});
    if(path.endsWith('/routes'))return response(route());
    if(path.endsWith('/prequote'))return response(quote());
    if(path.endsWith('/book')){
     persisted=true;
     return lostAck?response({error:'ACK not received'},503):
      response(receipt(),201);
    }
    if(path.endsWith('/bookings/'+bookingKey))
     return persisted?response(receipt()):response({error:'not found'},404);
    throw Error('Unexpected G73 endpoint');
   }
  },
  statusGatewayOptions:{
   enabled:statusCertified,contractCertified:true,origin,pinnedOrigin:origin,
   fetchImpl:async(url,req)=>{
    const path=new URL(url).pathname;
    reqs.push({path,method:req.method});
    assert.equal(path,'/v1/staging/rider/trips/'+tripId+'/status');
    return persisted?(statusOverride?statusOverride():response(status()))
     :response({error:'not found'},404);
   }
  }
 });
 return {c,reqs,rotate:a=>identity=a,actor:()=>identity};
}
async function bookingFlow(f){
 const c=f.c;
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal((await c.requestAutoQuote(intent)).ok,true);
 assert.equal(c.snapshot().autoPrequote.quote.amountGs,15200);
 assert.equal(c.acceptAutoPrequote({quoteId,amountGs:15200,
  fareVersion:'qa-g73-f1'}).ok,true);
 return c.reserveQuotedAuto({requestKey:bookingKey});
}
test('G74 REAL B consumer pipeline: one route -> server fare -> consent -> booking -> own G4 read',async()=>{
 const f=fixture();
 assert.equal((await bookingFlow(f)).ok,true);
 assert.equal(f.c.snapshot().autoPrequote.tripId,tripId);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,true);
 assert.equal(f.reqs.length,3,'booking alone never performs status GET');
 assert.equal((await f.c.continueVerifiedRide()).ok,true);
 const s=f.c.snapshot();
 assert.equal(s.tracking.tripId,tripId);
 assert.equal(s.tracking.state,'searching');
 assert.equal(s.tracking.assignedDriver,null);
 assert.equal(s.tracking.position,null);
 assert.equal(s.tracking.etaMinutes,null);
 assert.equal(s.rideContinuation.productionEnabled,false);
 assert.equal(s.autoPrequote.productionEnabled,false);
 assert.deepEqual(f.reqs.map(x=>x.method),['POST','POST','POST','GET']);
 assert.deepEqual(f.reqs.map(x=>x.path),[
  '/v1/staging/rider/auto/routes',
  '/v1/staging/rider/auto/prequote',
  '/v1/staging/rider/auto/book',
  '/v1/staging/rider/trips/'+tripId+'/status']);
 assert.equal(JSON.stringify(s).includes(f.actor().token),false);
});
test('G74 lost ACK: same bookingKey owner GET, then separate own G4 GET with zero POST replay',async()=>{
 const f=fixture({lostAck:true});
 assert.equal((await bookingFlow(f)).code,'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.reconcileQuotedAuto()).recoveredWithoutPost,true);
 assert.equal((await f.c.continueVerifiedRide()).ok,true);
 assert.deepEqual(f.reqs.map(x=>x.method),['POST','POST','POST','GET','GET']);
 assert.equal(f.reqs.filter(x=>x.path.endsWith('/book')).length,1);
 assert.equal(f.reqs.filter(x=>x.path.endsWith('/bookings/'+bookingKey)).length,1);
 assert.equal(f.reqs.filter(x=>x.path.endsWith('/trips/'+tripId+'/status')).length,1);
});
test('G74 no independently certified G4 GET means no tracking even with persisted booking',async()=>{
 const f=fixture({statusCertified:false});
 assert.equal((await bookingFlow(f)).ok,true);
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.deepEqual(f.reqs.map(x=>x.method),['POST','POST','POST']);
});
test('G74 foreign status, generic 200 and revision below persisted booking block tracking',async()=>{
 for(const override of [
  ()=>response(status({ownerId:foreign})),
  ()=>response({tripId,ownerId:passenger,revision:1,state:'searching'}),
  ()=>response(status({revision:0}))
 ]){
  const f=fixture({statusOverride:override});
  assert.equal((await bookingFlow(f)).ok,true);
  assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_STATUS_NOT_VERIFIED');
  assert.equal(f.c.snapshot().tracking.tripId,null);
  assert.equal(f.c.snapshot().tracking.subscriptionActive,false);
  assert.equal(f.reqs.filter(x=>x.method==='POST').length,3);
 }
});
test('G74 JWT rotation after booking discards proof before status read',async()=>{
 const f=fixture();
 assert.equal((await bookingFlow(f)).ok,true);
 f.rotate({...f.actor(),token:'rotated-passenger-token-abcdefghijklmnopqrstuvwxyz'});
 await f.c.refreshSession();
 assert.equal(f.c.snapshot().rideContinuation.canVerify,false);
 assert.equal((await f.c.continueVerifiedRide()).code,'RIDE_CONTINUATION_NOT_CERTIFIED');
 assert.equal(f.reqs.length,3);
});
