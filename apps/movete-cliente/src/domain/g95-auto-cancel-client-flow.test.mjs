import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
const now=1900000000000;
const id=n=>'95950000-0000-4959-8959-'+String(n).padStart(12,'0');
const owner=id(1),routeId=id(2),quoteId=id(3),routeKey=id(4),
 bookingKey=id(5),tripId=id(6),campaign=id(7),cancelKey=id(8),eventId=id(9),other=id(10);
const routeInput={origin:'Villa Morra',destination:'Centro de Asunción',
 service:'economico',quoteRequestKey:routeKey};
const route={routeId,ownerId:owner,quoteRequestKey:routeKey,
 origin:routeInput.origin,destination:routeInput.destination,service:'economico',
 routingVerified:true,coverageVerified:true,expiresAt:now+300000,
 source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'};
const quote={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,routeId,quoteId,quoteRequestKey:routeKey,fareMode:'AUTO',
 service:'economico',currency:'PYG',amountGs:30000,fareVersion:'g95_qa_1',
 expiresAt:now+120000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'};
const promo={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,quoteId,campaignId:campaign,serviceKind:'AUTO_RIDE',
 currency:'PYG',originalFareGs:30000,commissionBps:1500,subsidyBps:1000,
 nominalCommissionGs:4500,customerSubsidyGs:3000,customerPaysGs:27000,
 driverReceivesGs:25500,platformRetainsGs:1500,fareVersion:'g95_qa_1',
 expiresAt:now+90000,serverPersisted:true};
const booked={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,requestKey:bookingKey,quoteId,routeId,tripId,revision:1,
 serverPersisted:true,status:'ACCEPTED_QA'};
const status={tripId,ownerId:owner,revision:2,state:'searching',
 assignmentPersisted:false,driver:null,vehicle:null,gpsConsent:false,
 location:null,etaVerified:false,etaMinutes:null,mode:'STAGING_DEMO_ONLY',
 commercialRidesEnabled:false,event:{source:'server',tripId,passengerId:owner,
 serverRevision:2,trackingSequence:1,status:'searching',acceptedDriver:null,tracking:null},
 locationVisible:false,deliveryConfirmed:false};
const receipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,bookingKey,cancellationKey:cancelKey,eventId,tripId,quoteId,
 tripState:'cancelled',tripRevision:3,financialState:'VOIDED_QA',
 reversalEntriesBalanced:true,pspCollected:false,pspRefunded:false,serverPersisted:true};
const res=(data,http=200)=>({status:http,ok:http>=200&&http<300,
 redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
function setup({lostAck=false,receiptPatch={},cancelEnabled=true,statusEnabled=true}={}){
 let auth={subject:owner,role:'passenger',
  token:'qa-passenger-jwt-g95-abcdefghijklmnopqrst',expiresAt:now+600000};
 const calls=[];
 const c=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>auth,signOut:async()=>{}},
  statusGatewayOptions:statusEnabled?{enabled:true,contractCertified:true,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,init)=>{
    calls.push({method:init.method,path:new URL(url).pathname,body:null});
    return res(status);
   }}:null,
  autoG73HttpOptions:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   routeProviderCertified:true,subsidyContractCertified:true,financialContractCertified:true,
   cancellationContractCertified:cancelEnabled,origin:'https://qa.example.invalid',
   pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,init)=>{
    const path=new URL(url).pathname;
    calls.push({method:init.method,path,body:init.body??null});
    if(path.endsWith('/routes'))return res(route);
    if(path.endsWith('/prequote'))return res(quote);
    if(path.endsWith('/subsidy'))return res(promo);
    if(path.endsWith('/book'))return res(booked,201);
    if(path.endsWith('/cancel'))return lostAck?res({error:'maybe committed'},503)
     :res({...receipt,...receiptPatch});
    if(path.endsWith('/cancellation'))return res({...receipt,...receiptPatch});
    throw Error('Unexpected route '+path);
   }}
 });
 return {c,calls,rotate:()=>auth={...auth,token:'rotated-g95-qa-jwt-abcdefghijklmnopqrst'}};
}
async function setupRide(f){
 await f.c.refreshSession();
 assert.equal((await f.c.requestAutoQuote(routeInput)).ok,true);
 assert.equal((await f.c.loadAutoSubsidy()).ok,true);
 assert.equal(f.c.acceptAutoPrequote({quoteId,amountGs:30000,
  fareVersion:'g95_qa_1',campaignId:campaign,customerPaysGs:27000}).ok,true);
 assert.equal((await f.c.reserveQuotedAuto({requestKey:bookingKey})).ok,true);
}
async function tracked(f){
 await setupRide(f);
 assert.equal((await f.c.continueVerifiedRide()).ok,true);
 assert.equal(f.c.snapshot().g95Cancellation.contractReady,true);
}
test('G95 passenger uses one POST after own G73 booking and independently confirmed G4 trip',async()=>{
 const f=setup();await tracked(f);
 assert.equal(f.c.prepareG95Cancel({requestKey:cancelKey}).ok,true);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'ready');
 assert.equal((await f.c.sendG95Cancel()).ok,true);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'confirmed');
 assert.equal(f.c.snapshot().g95Cancellation.financialState,'VOIDED_QA');
 assert.equal((await f.c.sendG95Cancel()).ok,false);
 assert.equal((await f.c.reconcileG95Cancel()).ok,false);
 assert.equal(f.c.snapshot().tracking.state,'searching');
 const posts=f.calls.filter(x=>x.path.endsWith('/cancel'));
 assert.equal(posts.length,1);
 assert.equal(posts[0].method,'POST');
 assert.deepEqual(JSON.parse(posts[0].body),{requestKey:cancelKey,confirmed:true});
 assert.equal(f.calls.some(x=>x.path.endsWith('/cancellation')),false);
 assert.equal(JSON.stringify(f.c.snapshot()).includes(cancelKey),false);
});
test('G95 uncertain ACK can only be reconciled by own GET; no second POST',async()=>{
 const f=setup({lostAck:true});await tracked(f);
 assert.equal(f.c.prepareG95Cancel({requestKey:cancelKey}).ok,true);
 assert.equal((await f.c.sendG95Cancel()).code,'G95_GET_RECONCILIATION_REQUIRED');
 assert.equal(f.c.snapshot().g95Cancellation.requiresReconciliation,true);
 assert.equal(f.c.prepareG95Cancel({requestKey:id(20)}).ok,false);
 assert.equal((await f.c.sendG95Cancel()).ok,false);
 const read=await f.c.reconcileG95Cancel();
 assert.equal(read.ok,true);
 assert.equal(read.recoveredWithoutPost,true);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'confirmed');
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancel')).length,1);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancellation')).length,1);
 assert.equal(f.calls.at(-1).method,'GET');
 assert.equal(f.calls.at(-1).body,null);
});
test('G95 rejects fabricated receipts, lost proof, missing G4 and JWT rotation',async()=>{
 for(const patch of [
  {ownerId:other},{bookingKey:other},{cancellationKey:other},
  {tripId:other},{quoteId:other},{eventId:'bad'},{tripRevision:1},
  {tripState:'completed'},{financialState:'PAID'},
  {financialState:'VOIDED_QA',reversalEntriesBalanced:false},
  {pspCollected:true},{pspRefunded:true},{serverPersisted:false},{hack:'yes'}
 ]){
  const f=setup({receiptPatch:patch});await tracked(f);
  f.c.prepareG95Cancel({requestKey:cancelKey});
  assert.equal((await f.c.sendG95Cancel()).ok,false,JSON.stringify(patch));
  assert.equal(f.c.snapshot().g95Cancellation.requiresReconciliation,true);
  assert.equal(f.calls.filter(x=>x.path.endsWith('/cancel')).length,1);
 }
 const f=setup({statusEnabled:false});await setupRide(f);
 assert.equal(f.c.snapshot().g95Cancellation.contractReady,false);
 assert.equal(f.c.prepareG95Cancel({requestKey:cancelKey}).ok,false);
 const g=setup({cancelEnabled:false});await setupRide(g);
 assert.equal(g.c.snapshot().g95Cancellation.contractReady,false);
 assert.equal(g.c.prepareG95Cancel({requestKey:cancelKey}).ok,false);
 const h=setup();await tracked(h);
 h.c.prepareG95Cancel({requestKey:cancelKey});
 h.rotate();await h.c.refreshSession();
 assert.equal((await h.c.sendG95Cancel()).ok,false);
 assert.equal(h.c.snapshot().g95Cancellation.phase,'idle');
 assert.equal(h.calls.filter(x=>x.path.endsWith('/cancel')).length,0);
});
