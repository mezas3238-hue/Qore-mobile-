import test from 'node:test';
import assert from 'node:assert/strict';
import {createG122DeliveryPriceConsentFlow}
 from './g122-delivery-price-consent-flow.mjs';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'23500000-0000-4235-8235-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),deliveryId=id(3),requestKey=id(4),
 quoteRequestKey=id(5),quoteId=id(6),confirmationKey=id(7),consentId=id(8);
const origin='https://qore-b23-g126.onrender.com';
const scope={ownerId:owner,deliveryId,requestKey,vehicleKind:'MOTO',sessionRevision:1};
const flags={enabled:true,contractCertified:true,externalRuntimeVerified:true,
 ownerTariffVerified:true,officialRoutingVerified:true,g123FenceVerified:true,
 ownerApproved:true,g126OriginalKeyRecoveryVerified:true,
 requireDurableQuoteKey:true,sourceOrigin:origin,pinnedOrigin:origin,
 now:()=>T};
const actor=()=>({role:'passenger',subject:owner,token:'b23-passenger-jwt-1234567890123456',
 authRevision:1,sessionRevision:1,expiresAt:T+60000});
const response=(dto,status=201)=>({ok:true,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(dto)});
const quote=()=>({mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
 serverPriced:true,ownerId:owner,quoteId,amountGs:30000,
 fareMode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId,
 expiresAt:T+50000,fareVersion:'owner-cargo-moto-v4',routingVerified:true,
 quote:{id:quoteId,mode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId,
 ruleVersion:'owner-cargo-moto-v4',subtotalPyg:30000,tollsPyg:0,
 totalPyg:30000,commissionBps:1600,commissionPyg:4800,
 providerPyg:25200,expiresAt:new Date(T+50000).toISOString()}});
const consent=()=>({mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
 paymentAuthorized:false,dispatchEnabled:false,
 ownerId:owner,consentId,deliveryId,quoteId,confirmationKey,
 vehicleKind:'MOTO',acceptedTotalGs:30000,
 fareVersion:'owner-cargo-moto-v4',status:'confirmed_qa',serverPersisted:true});
function secureVault(){
 const entries=new Map(),log=[];
 const store={
  read:async ownerId=>entries.get(ownerId)??null,
  write:async row=>{
   if(entries.has(row.ownerId))throw Error('Cannot overwrite pending quote');
   entries.set(row.ownerId,{...row});log.push('write');
  },
  mark:async(ownerId,key,stage)=>{
   const old=entries.get(ownerId);
   if(!old||old.quoteRequestKey!==key
    ||stage==='recovery_attempted'&&old.stage!=='prepared'
    ||stage==='consent_attempted'&&old.stage==='consent_attempted')
    throw Error('Cannot mark quote twice');
   entries.set(ownerId,{...old,stage});log.push(stage);
  }
 };
 return {store,entries,log};
}
const flow=(vault,fetchImpl,more={})=>createG122DeliveryPriceConsentFlow({
 ...flags,quoteKeyStore:vault,getSession:()=>actor(),fetchImpl,...more
});
test('B23 B22 original quoteKey survives process restart and no 2nd G7 key',async()=>{
 const v=secureVault(),posts=[];
 const first=flow(v.store,async(url,opts)=>{
  posts.push(JSON.parse(opts.body));throw Error('ACK LOST AFTER G7 COMMIT');
 });
 assert.equal((await first.quote(scope,quoteRequestKey)).code,'NETWORK_OR_TIMEOUT');
 assert.equal(posts.length,1);
 assert.deepEqual(Object.keys(v.entries.get(owner)).sort(),
  ['version','ownerId','deliveryId','deliveryRequestKey',
   'quoteRequestKey','vehicleKind','createdAt','stage'].sort());
 assert.equal(JSON.stringify(v.entries.get(owner)).includes('30000'),false);
 assert.equal(v.entries.get(owner).stage,'prepared');
 const second=flow(v.store,async(url,opts)=>{
  posts.push(JSON.parse(opts.body));return response(quote());
 });
 const restored=await second.restoreOriginalQuote(scope);
 assert.equal(restored.ok,true);
 assert.equal(restored.restored,true);
 assert.equal(second.snapshot().canQuote,false);
 assert.equal(second.snapshot().canRecoverQuote,true);
 assert.equal(posts.length,1);
 const q=await second.recoverOriginalQuote();
 assert.equal(q.ok,true);
 assert.equal(q.quote.amountGs,30000);
 assert.deepEqual(posts.map(p=>p.requestKey),[quoteRequestKey,quoteRequestKey]);
 assert.equal(v.entries.get(owner).stage,'recovery_attempted');
 assert.equal(second.snapshot().canConfirm,true);
});
test('B23 server accepted consent and then process died: reboot blocks another G122 POST',async()=>{
 const v=secureVault(),calls=[];
 const first=flow(v.store,async(url,opts)=>{
  calls.push(url);if(url.endsWith('/quote'))return response(quote());
  throw Error('lost G122 ACK');
 });
 assert.equal((await first.quote(scope,quoteRequestKey)).ok,true);
 assert.equal((await first.confirm({confirmationKey,acceptedTotalGs:30000,
  acceptedFareVersion:'owner-cargo-moto-v4'})).ok,false);
 assert.equal(v.entries.get(owner).stage,'consent_attempted');
 const reloaded=flow(v.store,async()=>{throw Error('MUST NOT POST');});
 const restored=await reloaded.restoreOriginalQuote(scope);
 assert.equal(restored.ok,true);
 assert.equal(reloaded.snapshot().phase,'consent_unknown');
 assert.equal(reloaded.snapshot().canRecoverQuote,false);
 assert.equal(reloaded.snapshot().canConfirm,false);
 assert.equal((await reloaded.recoverOriginalQuote()).code,'G126_NO_RECOVERABLE_QUOTE');
 assert.equal(calls.length,2);
});
test('B23 crash after attempt to recover cannot produce another POST after restart',async()=>{
 const v=secureVault();
 const first=flow(v.store,async()=>{throw Error('offline');});
 await first.quote(scope,quoteRequestKey);
 assert.equal((await first.recoverOriginalQuote()).ok,false);
 assert.equal(v.entries.get(owner).stage,'recovery_attempted');
 const fresh=flow(v.store,async()=>{throw Error('unexpected HTTP');});
 assert.equal((await fresh.restoreOriginalQuote(scope)).ok,true);
 assert.equal(fresh.snapshot().canRecoverQuote,false);
 assert.equal((await fresh.quote(scope,id(40))).code,'G122_ALREADY_STARTED');
});
test('B23 unreadable/key mismatch and failed writes block HTTP, no invented quote',async()=>{
 for(const store of [
  {...secureVault().store,read:async()=>{throw Error('locked')}},
  {...secureVault().store,write:async()=>{throw Error('disk full')}}
 ]){
  let calls=0;const f=flow(store,async()=>{calls++;return response(quote());});
  const x=await f.quote(scope,quoteRequestKey);
  assert.equal(x.ok,false);assert.equal(calls,0);
  assert.equal(f.snapshot().canQuote,false);
 }
 const v=secureVault();
 const f=flow(v.store,async()=>{throw Error('offline');});
 await f.quote(scope,quoteRequestKey);
 const again=flow(v.store,async()=>{throw Error('MUST NOT POST');});
 assert.equal((await again.restoreOriginalQuote({...scope,deliveryId:id(56)})).code,
  'G126_ORIGINAL_SCOPE_MISMATCH'); // existing key is for a different delivery
});
test('B23 if native quote keystore missing: no G7 POST',async()=>{
 let calls=0;
 const f=flow(null,async()=>{calls++;return response(quote());});
 assert.equal((await f.quote(scope,quoteRequestKey)).code,'G126_SECURE_STORE_REQUIRED');
 assert.equal(calls,0);
});
test('B23 integration: re-login, G121 GET and original saved G7 key automatically restore without POST',async()=>{
 const v=secureVault(),deliveryRecord={version:1,ownerId:owner,
  requestKey,createdAt:T};
 let posts=0,readbacks=0;
 const app=createClientExperience({now:()=>T,
  deliveryQuoteKeyStore:v.store,
  deliveryRecoveryStore:{read:async()=>deliveryRecord,
   write:async()=>{},clear:async()=>{}},
  authProvider:{readSession:async()=>({role:'passenger',subject:owner,
   token:'b23-passenger-jwt-1234567890123456',expiresAt:T+60000}),
   signOut:async()=>{}},
  deliveryRegistrationOptions:{enabled:true,contractCertified:true,
   externalRuntimeVerified:true,passengerRlsVerified:true,ownerApproved:true,
   origin,pinnedOrigin:origin,fetchImpl:async()=>{
    readbacks++;return response({mode:'STAGING_DEMO_ONLY',
     liveDeliveriesEnabled:false,serverPersisted:true,ownerId:owner,
     requestKey,deliveryId,vehicleKind:'MOTO',status:'requested',revision:1},200);
   }},
  deliveryG122Options:{...flags,fetchImpl:async()=>{posts++;return response(quote());}}
 });
 assert.equal((await app.refreshSession()).ok,true);
 assert.equal(app.snapshot().mutation.requestKey,requestKey);
 assert.equal(app.snapshot().deliveryPriceConsent.canQuote,false);
 await v.store.write({version:1,ownerId:owner,deliveryId,
  deliveryRequestKey:requestKey,quoteRequestKey,
  vehicleKind:'MOTO',createdAt:T,stage:'prepared'});
 assert.equal((await app.readUnconfirmedDeliveryRegistration()).ok,true);
 assert.equal(readbacks,1);
 assert.equal(posts,0);
 assert.equal(app.snapshot().deliveryPriceConsent.canRecoverQuote,true);
 assert.equal((await app.recoverOriginalDeliveryQuote()).ok,true);
 assert.equal(posts,1);
 assert.equal(app.snapshot().deliveryPriceConsent.quote.amountGs,30000);
});
