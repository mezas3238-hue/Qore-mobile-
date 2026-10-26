import test from 'node:test';
import assert from 'node:assert/strict';
import {createG100MotoPassengerFlow} from './g100-moto-passenger-flow.mjs';

const t=1900000000000,id=n=>'80000000-0000-4800-8800-'+String(n).padStart(12,'0');
const owner=id(1),quoteId=id(2),quoteRequestKey=id(3),campaignId=id(4),
 bookingKey=id(5),tripId=id(6),cancellationKey=id(7),event=id(8);
let actor={role:'passenger',subject:owner,sessionRevision:1,expiresAt:t+600000};
const quote={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
 serviceKind:'MOTO_RIDE',service:'moto_pasajero',quoteId,quoteRequestKey,
 campaignId,currency:'PYG',amountGs:11000,commissionBps:1200,
 subsidyBps:1000,customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,expiresAt:t+300000,
 driverAssigned:false,pspCollected:false,serverPersisted:true};
const booked={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
 serviceKind:'MOTO_RIDE',service:'moto_pasajero',bookingKey,quoteId,tripId,
 tripState:'searching',tripRevision:1,cancellationKey:null,cancellationEventId:null,
 currency:'PYG',amountGs:11000,customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,commissionBps:1200,subsidyBps:1000,
 financialState:'RESERVED_QA',reversalEntriesBalanced:false,
 driverAssigned:false,pspCollected:false,pspRefunded:false,serverPersisted:true};
const cancelled={...booked,tripState:'cancelled',tripRevision:2,
 cancellationKey,cancellationEventId:event,financialState:'VOIDED_QA',
 reversalEntriesBalanced:true};
const store=()=>{let r=null;return{
 read:async()=>r,write:async v=>{r=structuredClone(v);},
 clear:async()=>{r=null;},saved:()=>r}};
function make(st,calls=[],overrides={}){
 return createG100MotoPassengerFlow({
  enabled:true,contractCertified:true,externalRuntimeVerified:true,
  motoLegalVerified:true,motoRouteVerified:true,now:()=>t,
  getActor:()=>actor,recoveryStore:st,
  quoteGateway:async()=>({ok:true,data:quote}),
  bookGateway:async()=>{calls.push('POST book');return overrides.book??{ok:true,data:booked};},
  bookingReadGateway:async()=>{calls.push('GET book');return overrides.read??{ok:true,data:booked};},
  cancelGateway:async()=>{calls.push('POST cancel');return overrides.cancel??{ok:true,data:cancelled};},
  cancelReadGateway:async()=>{calls.push('GET cancel');return overrides.cancelRead??{ok:true,data:cancelled};}
 });
}
async function prepare(f){
 assert.equal((await f.restore()).ok,true);
 assert.equal((await f.requestQuote({origin:'Centro',destination:'Aeropuerto',
  quoteRequestKey,safetyAcknowledged:true})).ok,true);
 assert.equal(f.acceptQuote({quoteId,customerPaysGs:9900}).ok,true);
}
test('R81 MOTO booking crash: save before POST; GET on restart; no fare/address persisted',async()=>{
 actor={...actor,subject:owner,sessionRevision:1};
 const st=store(),calls=[],first=make(st,calls,{book:{ok:false}});
 assert.equal(first.snapshot().contractReady,false);
 assert.equal((await first.requestQuote({})).ok,false);
 await prepare(first);assert.equal((await first.book({bookingKey})).ok,false);
 assert.deepEqual(calls,['POST book']);
 const r=st.saved();
 assert.deepEqual(Object.keys(r).sort(),[
  'version','ownerId','quoteId','bookingKey','cancellationKey','tripId','createdAt'].sort());
 assert.equal(r.bookingKey,bookingKey);
 assert.equal(JSON.stringify(r).includes('11000'),false);
 assert.equal(JSON.stringify(r).includes('Centro'),false);
 const second=make(st,calls);
 assert.equal((await second.restore()).ok,true);
 assert.deepEqual(calls,['POST book','GET book']);
 assert.equal(second.snapshot().phase,'booked');
 assert.equal(second.snapshot().quote.customerPaysGs,9900);
 assert.equal(second.snapshot().contractReady,true);
});
test('R81 MOTO cancel crash: saves cancellationKey/tripId; GET without duplicate POST',async()=>{
 actor={...actor,subject:owner,sessionRevision:1};
 const st=store(),calls=[],first=make(st,calls,{cancel:{ok:false}});
 await prepare(first);assert.equal((await first.book({bookingKey})).ok,true);
 assert.equal((await first.cancel({cancellationKey})).ok,false);
 assert.equal(st.saved().cancellationKey,cancellationKey);
 assert.equal(st.saved().tripId,tripId);
 const second=make(st,calls);
 assert.equal((await second.restore()).ok,true);
 assert.deepEqual(calls,['POST book','POST cancel','GET cancel']);
 assert.equal(second.snapshot().cancelled,true);
 assert.equal((await second.clearConfirmedCancellation()).ok,true);
 assert.equal(st.saved(),null);
 assert.equal(second.snapshot().contractReady,true);
});
test('R81 wrong owner, forged receipt, failed secure write and 404 block new POST',async()=>{
 actor={...actor,subject:owner,sessionRevision:1};
 const st=store(),calls=[],first=make(st,calls,{book:{ok:false}});
 await prepare(first);await first.book({bookingKey});
 actor={...actor,subject:id(9),sessionRevision:2};
 const foreign=make(st,calls);
 assert.equal((await foreign.restore()).code,'MOTO_SAVED_SCOPE_INVALID');
 assert.equal(foreign.snapshot().contractReady,false);
 assert.equal(calls.length,1);
 actor={...actor,subject:owner,sessionRevision:3};
 const fake=make(st,calls,{read:{ok:true,data:{...booked,platformRetainsGs:500}}});
 assert.equal((await fake.restore()).code,'MOTO_PRIVATE_GET_UNVERIFIED');
 assert.equal(fake.snapshot().needsReadback,true);
 assert.equal(fake.snapshot().contractReady,false);
 const missing=make(st,calls,{read:{ok:false,status:404}});
 assert.equal((await missing.restore()).code,'MOTO_PRIVATE_GET_UNVERIFIED');
 assert.equal((await missing.requestQuote({})).ok,false);
 const invalid={read:async()=>null,write:async()=>{throw Error('keystore locked');},clear:async()=>{}};
 const app=make(invalid,calls);await prepare(app);
 assert.equal((await app.book({bookingKey})).code,'MOTO_SECURE_SAVE_FAILED_NO_POST');
 assert.equal(calls.filter(x=>x==='POST book').length,1);
});
test('R81 stale session during recovery does not expose old passenger receipt',async()=>{
 actor={...actor,subject:owner,sessionRevision:1};
 const st=store(),a=make(st);
 await prepare(a);await a.book({bookingKey});
 let release;
 const pending=new Promise(resolve=>{release=resolve});
 const old=make(st,[],{read:()=>pending});
 const attempt=old.restore();
 actor={...actor,subject:id(10),sessionRevision:2};
 release({ok:true,data:booked});
 assert.equal((await attempt).code,'MOTO_STALE_SESSION');
 assert.equal(old.snapshot().quote,null);
});
