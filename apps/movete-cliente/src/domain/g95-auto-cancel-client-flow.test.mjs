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
function setup({lostAck=false,receiptPatch={},cancelEnabled=true,statusEnabled=true,
 ledgerPatch={},sharedStore=null,bookingOverride=null}={}){
 let currentTime=now,serverCancelled=false;
 let auth={subject:owner,role:'passenger',
  token:'qa-passenger-jwt-g95-abcdefghijklmnopqrst',expiresAt:now+600000};
 const calls=[];
 const c=createClientExperience({now:()=>currentTime,
  g95RecoveryStore:sharedStore,
  authProvider:{readSession:async()=>auth,signOut:async()=>{}},
  statusGatewayOptions:statusEnabled?{enabled:true,contractCertified:true,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,init)=>{
    calls.push({method:init.method,path:new URL(url).pathname,body:null});
    const next=serverCancelled?{...status,state:'cancelled',revision:3,
     event:{...status.event,status:'cancelled',serverRevision:3,
      trackingSequence:2}}:status;
    return res(next);
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
    if(path==='/v1/staging/rider/auto/bookings/'+bookingKey)
     return res(bookingOverride??booked);
    if(path.endsWith('/financial-status'))return res({
     mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
     bookingKey,tripId,quoteId,tripState:'cancelled',tripRevision:3,
     financialState:'VOIDED_QA',customerPaysGs:27000,driverReceivesGs:25500,
     customerSubsidyGs:3000,platformRetainsGs:1500,
     originalEntriesBalanced:true,reversalEntriesBalanced:true,
     pspCollected:false,pspRefunded:false,serverPersisted:true,...ledgerPatch
    });
    if(path.endsWith('/cancel'))return lostAck?res({error:'maybe committed'},503)
     :res({...receipt,...receiptPatch});
    if(path.endsWith('/cancellation'))return res({...receipt,...receiptPatch});
    throw Error('Unexpected route '+path);
   }}
 });
 return {c,calls,
  rotate:()=>auth={...auth,token:'rotated-g95-qa-jwt-abcdefghijklmnopqrst'},
  advance:ms=>{currentTime+=ms;},confirmServerCancel:()=>{serverCancelled=true;}};
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

test('G95 cancellation confirmation can be discarded BEFORE any network action',async()=>{
 const f=setup();await tracked(f);
 assert.equal(f.c.prepareG95Cancel({requestKey:cancelKey}).ok,true);
 assert.equal(f.c.abandonG95PreparedCancel().ok,true);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'idle');
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancel')).length,0);
 assert.equal(f.c.prepareG95Cancel({requestKey:id(20)}).ok,true);
 assert.equal(f.c.abandonG95PreparedCancel().ok,true);
 const g=setup({lostAck:true});await tracked(g);
 g.c.prepareG95Cancel({requestKey:cancelKey});
 await g.c.sendG95Cancel();
 assert.equal(g.c.abandonG95PreparedCancel().ok,false);
 assert.equal(g.c.prepareG95Cancel({requestKey:id(20)}).ok,false);
 assert.equal(g.calls.filter(x=>x.path.endsWith('/cancel')).length,1);
});

test('R74 G95 uncertain cancellation remains GET-recoverable after G4 is stale for 60 seconds',async()=>{
 const f=setup({lostAck:true});await tracked(f);
 assert.equal(f.c.prepareG95Cancel({requestKey:cancelKey}).ok,true);
 assert.equal((await f.c.sendG95Cancel()).ok,false);
 f.advance(61000);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'ambiguous');
 assert.equal(f.c.snapshot().g95Cancellation.requiresReconciliation,true);
 assert.equal(f.c.snapshot().g95Cancellation.contractReady,false);
 assert.equal((await f.c.reconcileG95Cancel()).ok,true);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'confirmed');
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancel')).length,1);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancellation')).length,1);
});
test('R74 independently certifies G95 cancellation only with G4 cancelled and G94 balanced reversal',async()=>{
 const f=setup();await tracked(f);
 f.c.prepareG95Cancel({requestKey:cancelKey});
 assert.equal((await f.c.sendG95Cancel()).ok,true);
 const premature=await f.c.verifyG95Cancellation();
 assert.equal(premature.ok,false);
 assert.equal(premature.code,'G95_G4_CANCEL_NOT_VERIFIED');
 assert.equal(f.c.snapshot().g95Cancellation.phase,'confirmed');
 assert.equal(f.calls.filter(x=>x.path.endsWith('/financial-status')).length,0);
 f.confirmServerCancel();
 const verified=await f.c.verifyG95Cancellation();
 assert.equal(verified.ok,true);
 assert.deepEqual(verified.verifiedBy,['G4','G94']);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'verified');
 assert.equal(f.c.snapshot().g95Cancellation.independentlyVerified,true);
 assert.equal(f.c.snapshot().autoFinance.financialState,'VOIDED_QA');
 assert.equal((await f.c.verifyG95Cancellation()).ok,false);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancel')).length,1);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/financial-status')).length,1);
});
test('R74 does not certify a G95 receipt when G94 ledger is mismatched, even if G4 cancelled',async()=>{
 const f=setup({ledgerPatch:{customerSubsidyGs:2000}});
 await tracked(f);
 f.c.prepareG95Cancel({requestKey:cancelKey});
 await f.c.sendG95Cancel();
 f.confirmServerCancel();
 const result=await f.c.verifyG95Cancellation();
 assert.equal(result.ok,false);
 assert.equal(result.code,'G95_G94_REVERSAL_NOT_VERIFIED');
 assert.equal(f.c.snapshot().g95Cancellation.phase,'confirmed');
 assert.equal(f.c.snapshot().g95Cancellation.independentlyVerified,false);
 assert.equal(f.c.snapshot().autoFinance.financialState,null);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancel')).length,1);
});
test('R74 changing JWT removes private G95 receipt and forbids stale cancellation verification',async()=>{
 const f=setup();await tracked(f);
 f.c.prepareG95Cancel({requestKey:cancelKey});
 await f.c.sendG95Cancel();
 f.rotate();
 await f.c.refreshSession();
 f.confirmServerCancel();
 assert.equal((await f.c.verifyG95Cancellation()).ok,false);
 assert.equal(f.c.snapshot().g95Cancellation.independentlyVerified,false);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/financial-status')).length,0);
});

function secureG95Store(){
 let record=null,writes=0,deletes=0;
 return {
  async read(){return record===null?null:JSON.parse(JSON.stringify(record));},
  async write(value){record=JSON.parse(JSON.stringify(value));writes++;},
  async clear(){record=null;deletes++;},
  set(value){record=value;},
  get(){return record;},stats(){return {writes,deletes};}
 };
}
test('R75 G95 persists only opaque identifiers BEFORE POST; restart reauthenticates G73 and reconciles by GET',async()=>{
 const store=secureG95Store();
 const first=setup({lostAck:true,sharedStore:store});
 await tracked(first);
 assert.equal(first.c.prepareG95Cancel({requestKey:cancelKey}).ok,true);
 assert.equal((await first.c.sendG95Cancel()).ok,false);
 assert.equal(first.c.snapshot().g95Cancellation.phase,'ambiguous');
 assert.equal(store.stats().writes,1);
 const saved=store.get();
 assert.deepEqual(Object.keys(saved).sort(),[
  'cancellationKey','createdAt','ownerId','quoteId','requestKey',
  'routeId','serverRevision','tripId','version'].sort());
 for(const forbidden of ['token','bearer','gps','phone','originalFareGs',
  'driverReceivesGs','customerPaysGs','password','origin','destination']) {
  assert.equal(JSON.stringify(saved).includes(forbidden),false);
 }
 assert.equal(first.calls.filter(x=>x.path.endsWith('/cancel')).length,1);
 // A separate runtime instance emulates a terminated process + app restart.
 const reopened=setup({sharedStore:store});
 await reopened.c.refreshSession();
 assert.equal(reopened.c.snapshot().g95Cancellation.requiresReconciliation,false);
 const restored=await reopened.c.restoreG95Cancellation();
 assert.equal(restored.ok,true);
 assert.equal(reopened.c.snapshot().g95Cancellation.requiresReconciliation,true);
 assert.equal(reopened.c.snapshot().g95Cancellation.tripId,tripId);
 assert.equal(reopened.calls.filter(x=>x.path.endsWith('/'+bookingKey)).length,1);
 assert.equal(reopened.calls[0].method,'GET');
 assert.equal((await reopened.c.reconcileG95Cancel()).ok,true);
 assert.equal(reopened.c.snapshot().g95Cancellation.phase,'confirmed');
 assert.equal(reopened.c.snapshot().g95Cancellation.financialState,'VOIDED_QA');
 assert.equal(reopened.calls.filter(x=>x.path.endsWith('/cancel')).length,0);
 assert.equal(reopened.calls.filter(x=>x.path.endsWith('/cancellation')).length,1);
 assert.equal((await reopened.c.sendG95Cancel()).ok,false);
 await reopened.c.signOut();
 assert.equal(store.get(),null);
});
test('R75 refuses cancel POST if encrypted storage write fails before network',async()=>{
 let writes=0;
 const store={read:async()=>null,write:async()=>{writes++;throw Error('OS keychain locked');},
  clear:async()=>{}};
 const f=setup({sharedStore:store});await tracked(f);
 assert.equal(f.c.prepareG95Cancel({requestKey:cancelKey}).ok,true);
 assert.equal((await f.c.sendG95Cancel()).code,'G95_SECURE_SAVE_FAILED');
 assert.equal(writes,1);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancel')).length,0);
 assert.equal(f.c.snapshot().g95Cancellation.phase,'ready');
});
test('R75 corrupted, expired and cross-owner secure records cannot trigger G95 GET or POST',async()=>{
 const valid={version:1,createdAt:now,ownerId:owner,requestKey:bookingKey,
  quoteId,routeId,tripId,serverRevision:1,cancellationKey:cancelKey};
 const variants=[{...valid,ownerId:other},{...valid,tripId:'bad'},
  {...valid,createdAt:now-700000000},{...valid,cancellationKey:bookingKey},
  {...valid,jwt:'forged'},'not a record'];
 for(const entry of variants){
  const store=secureG95Store();store.set(entry);
  const f=setup({sharedStore:store});await f.c.refreshSession();
  const result=await f.c.restoreG95Cancellation();
  assert.equal(result.ok,false,JSON.stringify(entry));
  assert.equal(f.calls.length,0);
  assert.equal(f.c.snapshot().g95Cancellation.requiresReconciliation,false);
 }
});
test('R75 cannot restore a booking if authenticated G73 disagrees with stored trip',async()=>{
 const store=secureG95Store();
 store.set({version:1,createdAt:now,ownerId:owner,requestKey:bookingKey,
  quoteId,routeId,tripId,serverRevision:1,cancellationKey:cancelKey});
 const f=setup({sharedStore:store,bookingOverride:{...booked,tripId:other}});
 await f.c.refreshSession();
 assert.equal((await f.c.restoreG95Cancellation()).code,'G95_BOOKING_NOT_REVALIDATED');
 assert.equal(f.c.snapshot().g95Cancellation.phase,'idle');
 assert.equal(f.calls.filter(x=>x.path.endsWith('/cancellation')).length,0);
});

test('R76 recovered G73 and G95 enable one authorized G4 terminal check, never certify financial reversal',async()=>{
 const store=secureG95Store();
 const sender=setup({lostAck:true,sharedStore:store});await tracked(sender);
 sender.c.prepareG95Cancel({requestKey:cancelKey});
 assert.equal((await sender.c.sendG95Cancel()).ok,false);
 const resumed=setup({sharedStore:store});
 await resumed.c.refreshSession();
 assert.equal((await resumed.c.restoreG95Cancellation()).ok,true);
 assert.equal((await resumed.c.reconcileG95Cancel()).ok,true);
 let before=resumed.c.snapshot();
 assert.equal(before.g95Cancellation.statusReadReady,true);
 assert.equal(before.g95Cancellation.canVerify,false);
 assert.equal(before.g95Cancellation.statusIndependentlyVerified,false);
 resumed.confirmServerCancel();
 const answer=await resumed.c.verifyRecoveredG95RideStatus();
 assert.equal(answer.ok,true);
 assert.deepEqual(answer.verifiedBy,['G4']);
 assert.equal(answer.financeVerified,false);
 assert.equal(answer.pspRefunded,false);
 const after=resumed.c.snapshot();
 assert.equal(after.tracking.tripId,tripId);
 assert.equal(after.tracking.state,'cancelled');
 assert.equal(after.g95Cancellation.statusIndependentlyVerified,true);
 assert.equal(after.g95Cancellation.independentlyVerified,false);
 assert.equal(after.autoFinance.financialState,null);
 assert.equal((await resumed.c.verifyRecoveredG95RideStatus()).ok,false);
 assert.equal(resumed.calls.filter(x=>x.path.endsWith('/cancel')).length,0);
 assert.equal(resumed.calls.filter(x=>x.path.endsWith('/financial-status')).length,0);
 assert.equal(resumed.calls.filter(x=>x.path.includes('/rider/trips/')).length,1);
});
test('R76 stale G4 status after restart never authorizes cancellation claim; can retry same GET',async()=>{
 const store=secureG95Store();
 const sender=setup({lostAck:true,sharedStore:store});await tracked(sender);
 sender.c.prepareG95Cancel({requestKey:cancelKey});await sender.c.sendG95Cancel();
 const resumed=setup({sharedStore:store});await resumed.c.refreshSession();
 await resumed.c.restoreG95Cancellation();await resumed.c.reconcileG95Cancel();
 assert.equal((await resumed.c.verifyRecoveredG95RideStatus()).code,'G95_G4_CANCEL_NOT_VERIFIED');
 assert.equal(resumed.c.snapshot().tracking.subscriptionActive,false);
 assert.equal(resumed.c.snapshot().g95Cancellation.statusIndependentlyVerified,false);
 assert.equal(resumed.c.snapshot().g95Cancellation.statusReadReady,true);
 resumed.confirmServerCancel();
 assert.equal((await resumed.c.verifyRecoveredG95RideStatus()).ok,true);
 assert.equal(resumed.c.snapshot().g95Cancellation.statusIndependentlyVerified,true);
 assert.equal(resumed.calls.filter(x=>x.path.endsWith('/cancel')).length,0);
});
test('R76 no G4 contract, JWT rotation or no recovered G73 proof denies terminal lookup',async()=>{
 const store=secureG95Store();
 const sender=setup({lostAck:true,sharedStore:store});await tracked(sender);
 sender.c.prepareG95Cancel({requestKey:cancelKey});await sender.c.sendG95Cancel();
 const noStatus=setup({sharedStore:store,statusEnabled:false});
 await noStatus.c.refreshSession();await noStatus.c.restoreG95Cancellation();
 await noStatus.c.reconcileG95Cancel();
 assert.equal(noStatus.c.snapshot().g95Cancellation.statusReadReady,false);
 assert.equal((await noStatus.c.verifyRecoveredG95RideStatus()).ok,false);
 assert.equal(noStatus.calls.filter(x=>x.path.includes('/rider/trips/')).length,0);
 const rotated=setup({sharedStore:store});await rotated.c.refreshSession();
 await rotated.c.restoreG95Cancellation();await rotated.c.reconcileG95Cancel();
 rotated.rotate();await rotated.c.refreshSession();
 assert.equal((await rotated.c.verifyRecoveredG95RideStatus()).ok,false);
 assert.equal(rotated.c.snapshot().g95Cancellation.statusIndependentlyVerified,false);
 assert.equal(rotated.calls.filter(x=>x.path.includes('/rider/trips/')).length,0);
 const original=setup();await tracked(original);
 original.c.prepareG95Cancel({requestKey:cancelKey});await original.c.sendG95Cancel();
 assert.equal((await original.c.verifyRecoveredG95RideStatus()).ok,false);
});
