import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
const t=1900000000000;
const id=n=>'10010000-0000-4101-8101-'+String(n).padStart(12,'0');
const owner=id(1),quoteId=id(2),requestKey=id(3),
 campaignId=id(4),bookingKey=id(5),tripId=id(6),cancelKey=id(7),eventId=id(8);
const quote={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,serviceKind:'MOTO_RIDE',service:'moto_pasajero',quoteId,
 quoteRequestKey:requestKey,campaignId,currency:'PYG',amountGs:11000,
 commissionBps:1200,subsidyBps:1000,customerPaysGs:9900,
 customerSubsidyGs:1100,driverReceivesGs:9680,platformRetainsGs:220,
 expiresAt:t+200000,driverAssigned:false,pspCollected:false,serverPersisted:true};
const booked={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,serviceKind:'MOTO_RIDE',service:'moto_pasajero',bookingKey,
 quoteId,tripId,tripState:'searching',tripRevision:1,
 cancellationKey:null,cancellationEventId:null,currency:'PYG',amountGs:11000,
 customerPaysGs:9900,customerSubsidyGs:1100,driverReceivesGs:9680,
 platformRetainsGs:220,commissionBps:1200,subsidyBps:1000,
 financialState:'RESERVED_QA',reversalEntriesBalanced:false,
 driverAssigned:false,pspCollected:false,pspRefunded:false,serverPersisted:true};
test('R78 Client composes G100 MOTO as separately guarded booking/cancellation, not AUTO or delivery',async()=>{
 let auth={subject:owner,role:'passenger',expiresAt:t+600000,
  token:'moto-g100-qa-passenger-jwt-abcdefghijklmnop'},requests=0;
 const c=createClientExperience({
  now:()=>t,authProvider:{readSession:async()=>auth,signOut:async()=>{}},
  motoPassengerOptions:{
   enabled:true,contractCertified:true,externalRuntimeVerified:true,
   motoLegalVerified:true,motoRouteVerified:true,
   quoteGateway:async()=>{requests++;return {ok:true,data:quote};},
   bookGateway:async()=>{requests++;return {ok:true,data:booked};},
   bookingReadGateway:async()=>{throw Error('No GET needed');},
   cancelGateway:async()=>{requests++;return {ok:true,data:{
    ...booked,tripState:'cancelled',tripRevision:2,
    financialState:'VOIDED_QA',reversalEntriesBalanced:true,
    cancellationKey:cancelKey,cancellationEventId:eventId
   }};},
   cancelReadGateway:async()=>{throw Error('No GET needed');}
  }
 });
 await c.refreshSession();
 assert.equal(c.snapshot().motoPassenger.contractReady,true);
 assert.equal(c.snapshot().autoPrequote.tripId,null);
 assert.equal((await c.requestMotoQuote({origin:'Centro de Asunción',
  destination:'Villa Morra',quoteRequestKey:requestKey,
  safetyAcknowledged:true})).ok,true);
 assert.equal(c.snapshot().motoPassenger.quote.customerPaysGs,9900);
 assert.equal(c.snapshot().motoPassenger.quote.platformRetainsGs,220);
 assert.equal(c.acceptMotoQuote({quoteId,customerPaysGs:9900}).ok,true);
 assert.equal((await c.bookMoto({bookingKey})).ok,true);
 assert.equal(c.snapshot().motoPassenger.tripId,tripId);
 assert.equal(c.snapshot().autoPrequote.tripId,null);
 assert.equal(c.snapshot().g95Cancellation.phase,'idle');
 assert.equal((await c.cancelMoto({cancellationKey:cancelKey})).ok,true);
 assert.equal(c.snapshot().motoPassenger.cancelled,true);
 assert.equal(requests,3);
 assert.equal(c.snapshot().motoPassenger.productionEnabled,false);
 await c.signOut();
 assert.equal(c.snapshot().motoPassenger.phase,'idle');
 assert.equal(c.snapshot().motoPassenger.quote,null);
 assert.equal(c.snapshot().authenticated,false);
});
test('R78 default native Cliente never exposes MOTO prices or booking without A HTTPS attestation',async()=>{
 const c=createClientExperience({
  now:()=>t,authProvider:{readSession:async()=>({
   subject:owner,role:'passenger',expiresAt:t+600000,
   token:'moto-off-qa-passenger-jwt-abcdefghijklmnop'
  })}
 });
 await c.refreshSession();
 assert.equal(c.snapshot().motoPassenger.contractReady,false);
 assert.equal(c.snapshot().motoPassenger.quote,null);
 assert.equal((await c.requestMotoQuote({
  origin:'Centro de Asunción',destination:'Villa Morra',
  quoteRequestKey:requestKey,safetyAcknowledged:true
 })).ok,false);
 assert.equal((await c.bookMoto({bookingKey})).ok,false);
 assert.equal((await c.cancelMoto({cancellationKey:cancelKey})).ok,false);
 // Session invalidation does not trigger recursive UI notifications.
 let changes=0;const unsub=c.subscribe(()=>{changes++;c.snapshot();});
 c.clear();unsub();
 assert.equal(changes<10,true);
 assert.equal(c.snapshot().authenticated,false);
});
