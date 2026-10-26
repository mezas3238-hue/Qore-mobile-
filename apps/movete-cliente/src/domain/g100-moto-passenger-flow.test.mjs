import test from 'node:test';
import assert from 'node:assert/strict';
import {createG100MotoPassengerFlow} from './g100-moto-passenger-flow.mjs';
const now=1900000000000;
const id=n=>'10000000-0000-4100-8100-'+String(n).padStart(12,'0');
const owner=id(1),quoteId=id(2),quoteKey=id(3),campaignId=id(4),
 bookingKey=id(5),tripId=id(6),cancelKey=id(7),cancelEvent=id(8),foreign=id(9);
const actor={subject:owner,sessionRevision:1,role:'passenger',expiresAt:now+600000};
const quote={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,serviceKind:'MOTO_RIDE',service:'moto_pasajero',
 quoteId,quoteRequestKey:quoteKey,campaignId,currency:'PYG',
 amountGs:11000,commissionBps:1200,subsidyBps:1000,
 customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,expiresAt:now+300000,
 driverAssigned:false,pspCollected:false,serverPersisted:true};
const booked={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,serviceKind:'MOTO_RIDE',service:'moto_pasajero',
 bookingKey,quoteId,tripId,tripState:'searching',tripRevision:1,
 cancellationKey:null,cancellationEventId:null,currency:'PYG',
 amountGs:11000,customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,commissionBps:1200,
 subsidyBps:1000,financialState:'RESERVED_QA',
 reversalEntriesBalanced:false,driverAssigned:false,
 pspCollected:false,pspRefunded:false,serverPersisted:true};
const cancelled={...booked,tripState:'cancelled',tripRevision:2,
 cancellationKey:cancelKey,cancellationEventId:cancelEvent,
 financialState:'VOIDED_QA',reversalEntriesBalanced:true};
const intent={origin:'Centro de Asunción',destination:'Villa Morra',
 quoteRequestKey:quoteKey,safetyAcknowledged:true};
function setup({quoteReply=quote,bookReply=booked,cancelReply=cancelled,
 mutate=null,certified=true,missing=null}={}){
 const calls=[],session={...actor};
 const gateway={
  quoteGateway:async s=>{calls.push({kind:'quote',scope:s});return {ok:true,data:quoteReply};},
  bookGateway:async s=>{calls.push({kind:'book',scope:s});return bookReply===null?{ok:false}: {ok:true,data:bookReply};},
  bookingReadGateway:async s=>{calls.push({kind:'readBook',scope:s});return {ok:true,data:booked};},
  cancelGateway:async s=>{calls.push({kind:'cancel',scope:s});return cancelReply===null?{ok:false}: {ok:true,data:cancelReply};},
  cancelReadGateway:async s=>{calls.push({kind:'readCancel',scope:s});return {ok:true,data:cancelled};}
 };
 if(missing)gateway[missing]=null;
 const app=createG100MotoPassengerFlow({
  enabled:certified,contractCertified:certified,externalRuntimeVerified:certified,
  motoLegalVerified:certified,motoRouteVerified:certified,
  getActor:()=>session,now:()=>now,...gateway
 });
 const change=patch=>Object.assign(session,patch);
 return {app,calls,change};
}
async function quoted(f){
 assert.equal((await f.app.requestQuote(intent)).ok,true);
 assert.equal(f.app.snapshot().phase,'quoted');
}
async function bookedRide(f){
 await quoted(f);assert.equal(f.app.acceptQuote({quoteId,customerPaysGs:9900}).ok,true);
 assert.equal((await f.app.book({bookingKey})).ok,true);
}
test('R78 G100 MOTO Passenger only accepts real 12/10/2 server quote: no local tariff',async()=>{
 const f=setup();
 await quoted(f);
 assert.deepEqual(f.app.snapshot().quote,{
  quoteId,originalFareGs:11000,customerPaysGs:9900,customerSubsidyGs:1100,
  driverReceivesGs:9680,platformRetainsGs:220,commissionBps:1200,subsidyBps:1000,
  expiresAt:now+300000
 });
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].kind,'quote');
 assert.equal(f.calls[0].scope.serviceKind,'MOTO_RIDE');
 assert.equal(f.app.snapshot().productionEnabled,false);
 assert.equal(f.app.acceptQuote({quoteId,customerPaysGs:9500}).ok,false);
 assert.equal(f.app.acceptQuote({quoteId,customerPaysGs:9900}).ok,true);
 assert.equal((await f.app.book({bookingKey})).ok,true);
 assert.equal(f.app.snapshot().tripId,tripId);
 assert.equal(f.app.snapshot().phase,'booked');
 assert.equal((await f.app.book({bookingKey})).ok,false);
 assert.equal(f.calls.filter(x=>x.kind==='book').length,1);
 assert.equal((await f.app.cancel({cancellationKey:cancelKey})).ok,true);
 assert.equal(f.app.snapshot().cancelled,true);
 assert.equal((await f.app.cancel({cancellationKey:cancelKey})).ok,false);
 assert.equal(f.calls.filter(x=>x.kind==='cancel').length,1);
});
test('R78 duplicate mobile booking/cancel unknown ACK uses read-only recovery, never repeats POST',async()=>{
 const f=setup({bookReply:null,cancelReply:null});
 await quoted(f);f.app.acceptQuote({quoteId,customerPaysGs:9900});
 assert.equal((await f.app.book({bookingKey})).code,'MOTO_BOOK_READBACK_REQUIRED');
 assert.equal(f.app.snapshot().needsReadback,true);
 assert.equal((await f.app.book({bookingKey})).ok,false);
 assert.equal((await f.app.readBooking()).ok,true);
 assert.equal(f.app.snapshot().tripId,tripId);
 assert.equal((await f.app.cancel({cancellationKey:cancelKey})).code,'MOTO_CANCEL_READBACK_REQUIRED');
 assert.equal((await f.app.cancel({cancellationKey:id(10)})).ok,false);
 assert.equal((await f.app.readCancellation()).ok,true);
 assert.equal(f.app.snapshot().cancelled,true);
 assert.deepEqual(f.calls.map(x=>x.kind),['quote','book','readBook','cancel','readCancel']);
 assert.equal(f.calls.filter(x=>x.kind==='cancel').length,1);
});
test('R78 blocks malformed subsidy, owner, service, MOTO delivery or false PSP claims',async()=>{
 const patches=[
  {ownerId:foreign},{serviceKind:'MOTO_DELIVERY'},
  {service:'moto_reparto'},{commissionBps:1500},{subsidyBps:900},
  {amountGs:20000},{customerSubsidyGs:1000},
  {driverReceivesGs:10000},{platformRetainsGs:300},
  {customerPaysGs:10000},{driverAssigned:true},{pspCollected:true},
  {commercialEnabled:true},{currency:'USD'},
  {expiresAt:now-1},{serverPersisted:false},{phone:'+59599112345'}
 ];
 for(const p of patches){
  const f=setup({quoteReply:{...quote,...p}});
  assert.equal((await f.app.requestQuote(intent)).ok,false,JSON.stringify(p));
  assert.equal(f.app.snapshot().quote,null);
  assert.equal(f.calls.filter(x=>x.kind==='book').length,0);
 }
 for(const p of [
  {ownerId:foreign},{tripId:foreign,bookingKey:foreign},
  {tripState:'assigned'},{financialState:'PAID'},
  {commissionBps:1500},{pspRefunded:true},{serverPersisted:false},
  {reversalEntriesBalanced:true},{extra:'pii'}]){
  const f=setup({bookReply:{...booked,...p}});await quoted(f);
  f.app.acceptQuote({quoteId,customerPaysGs:9900});
  assert.equal((await f.app.book({bookingKey})).ok,false,JSON.stringify(p));
  assert.equal(f.app.snapshot().phase,'bookingUnknown');
  assert.equal(f.calls.filter(x=>x.kind==='book').length,1);
 }
});
test('R78 MOTO strict off switches, invalid route, actor rotation and private clearing',async()=>{
 for(const args of [{certified:false},{missing:'quoteGateway'},
  {missing:'cancelReadGateway'}]){
  const f=setup(args);
  assert.equal(f.app.snapshot().contractReady,false);
  assert.equal((await f.app.requestQuote(intent)).ok,false);
  assert.equal(f.calls.length,0);
 }
 for(const bad of [
  {...intent,safetyAcknowledged:false},
  {...intent,destination:intent.origin},{...intent,quoteRequestKey:'not-id'},
  {...intent,origin:'  bad'},{...intent,serviceKind:'AUTO_RIDE'}
 ]){
  const f=setup();
  // Any extraneous service flag must never change the authorized server kind.
  if(Object.hasOwn(bad,'serviceKind')){
   await f.app.requestQuote(bad);
   assert.equal(f.calls[0].scope.serviceKind,'MOTO_RIDE');
  }else{
   assert.equal((await f.app.requestQuote(bad)).ok,false);
   assert.equal(f.calls.length,0);
  }
 }
 const f=setup();await quoted(f);
 f.change({sessionRevision:2});
 assert.equal(f.app.snapshot().quote,null);
 assert.equal(f.app.acceptQuote({quoteId,customerPaysGs:9900}).ok,false);
 f.app.clear();
 assert.equal(f.app.snapshot().phase,'idle');
});

test('R80: MOTO discard only before booking, without POST or losing uncertain receipts',async()=>{
 const f=setup();await quoted(f);
 assert.equal(f.app.discardQuote().ok,true);
 assert.equal(f.app.snapshot().phase,'idle');
 assert.equal(f.app.snapshot().quote,null);
 assert.deepEqual(f.calls.map(x=>x.kind),['quote']);
 assert.equal(f.app.acceptQuote({quoteId,customerPaysGs:9900}).ok,false);
 await quoted(f);
 assert.equal(f.app.acceptQuote({quoteId,customerPaysGs:9900}).ok,true);
 assert.equal(f.app.discardQuote().ok,true);
 assert.equal(f.app.snapshot().tripId,null);
 assert.deepEqual(f.calls.map(x=>x.kind),['quote','quote']);
 const g=setup({bookReply:null});await quoted(g);
 assert.equal(g.app.acceptQuote({quoteId,customerPaysGs:9900}).ok,true);
 assert.equal((await g.app.book({bookingKey})).code,'MOTO_BOOK_READBACK_REQUIRED');
 assert.equal(g.app.discardQuote().code,'MOTO_QUOTE_NOT_DISCARDABLE');
 assert.equal(g.app.snapshot().phase,'bookingUnknown');
 assert.equal((await g.app.readBooking()).ok,true);
 assert.equal(g.app.discardQuote().ok,false);
 assert.equal(g.app.snapshot().tripId,tripId);
 assert.equal(g.calls.filter(x=>x.kind==='book').length,1);
});
test('R80: a quote cannot be discarded from a different or expired actor session',async()=>{
 const f=setup();await quoted(f);
 f.change({sessionRevision:2});
 assert.equal(f.app.discardQuote().code,'MOTO_QUOTE_NOT_DISCARDABLE');
 assert.equal(f.calls.length,1);
});
