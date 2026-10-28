import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const T=1900000000000;
const id=n=>'81818181-1818-4818-8818-'+String(n).padStart(12,'0');
const passenger=id(1),foreign=id(2),quoteId=id(3),quoteRequestKey=id(4),
 campaignId=id(5),bookingKey=id(6),tripId=id(7);
const jwt='synthetic-moto-passenger-jwt-abcdefghijklmnop';
const quote={
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:passenger,
 serviceKind:'MOTO_RIDE',service:'moto_pasajero',quoteId,quoteRequestKey,
 campaignId,currency:'PYG',amountGs:11000,commissionBps:1200,subsidyBps:1000,
 customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,expiresAt:T+300000,
 driverAssigned:false,pspCollected:false,serverPersisted:true
};
const booking={
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:passenger,
 serviceKind:'MOTO_RIDE',service:'moto_pasajero',bookingKey,quoteId,tripId,
 tripState:'searching',tripRevision:1,cancellationKey:null,cancellationEventId:null,
 currency:'PYG',amountGs:11000,customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,commissionBps:1200,subsidyBps:1000,
 financialState:'RESERVED_QA',reversalEntriesBalanced:false,
 driverAssigned:false,pspCollected:false,pspRefunded:false,serverPersisted:true
};
const session=(subject=passenger,token=jwt)=>({
 role:'passenger',subject,token,expiresAt:T+1000000
});
function scenario({saved=null,readError=false,bookingRead=booking}={}){
 let auth=null,reads=0,posts=0,quotes=0,gets=0,purges=0;
 let record=saved;
 const store={
  read:async()=>{reads++;if(readError)throw Error('Locked secure store');return record;},
  write:async value=>{record=value;},
  clear:async()=>{purges++;record=null;}
 };
 const client=createClientExperience({
  now:()=>T,
  authProvider:{readSession:async()=>auth,signOut:async()=>{auth=null;}},
  motoRecoveryStore:store,
  motoPassengerOptions:{
   enabled:true,contractCertified:true,externalRuntimeVerified:true,
   motoLegalVerified:true,motoRouteVerified:true,
   quoteGateway:async()=>{quotes++;return {ok:true,data:quote};},
   bookGateway:async()=>{posts++;return {ok:true,data:booking};},
   bookingReadGateway:async()=>{gets++;return {ok:true,data:bookingRead};},
   cancelGateway:async()=>({ok:false}),
   cancelReadGateway:async()=>({ok:false})
  }
 });
 return {client,setAuth:value=>{auth=value;},reads:()=>reads,
  posts:()=>posts,quotes:()=>quotes,gets:()=>gets,purges:()=>purges,
  saved:()=>record};
}
const intent={origin:'Centro de Asunción',destination:'Villa Morra',
 quoteRequestKey,safetyAcknowledged:true};
test('F1 login AFTER app mount initializes secure MOTO scope and quote without manual restore',async()=>{
 const s=scenario(),c=s.client;
 assert.equal(c.snapshot().motoPassenger.contractReady,false);
 assert.equal((await c.refreshSession()).ok,false);
 s.setAuth(session());
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(c.snapshot().motoPassenger.contractReady,true);
 assert.equal(s.reads(),1);
 assert.equal((await c.requestMotoQuote(intent)).ok,true);
 assert.equal(s.quotes(),1);
 assert.equal(c.snapshot().motoPassenger.phase,'quoted');
 // Same JWT refresh must preserve in-progress quote, never re-read the key.
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(s.reads(),1);
 assert.equal(c.snapshot().motoPassenger.phase,'quoted');
});
test('F1 JWT rotation clears old private quote and rechecks secure MOTO scope',async()=>{
 const s=scenario(),c=s.client;s.setAuth(session());
 await c.refreshSession();await c.requestMotoQuote(intent);
 s.setAuth(session(passenger,jwt+'-rotated'));
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(s.reads(),2);
 assert.equal(c.snapshot().motoPassenger.phase,'idle');
 assert.equal(c.snapshot().motoPassenger.quote,null);
 assert.equal(c.snapshot().motoPassenger.contractReady,true);
 assert.equal(s.posts(),0);
});
test('F1 login restores existing MOTO booking only via GET; never repeats POST',async()=>{
 const s=scenario({saved:{version:1,ownerId:passenger,quoteId,
  bookingKey,cancellationKey:null,tripId:null,createdAt:T}}),c=s.client;
 s.setAuth(session());
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(s.gets(),1);assert.equal(s.posts(),0);
 assert.equal(c.snapshot().motoPassenger.tripId,tripId);
 assert.equal(c.snapshot().motoPassenger.phase,'booked');
 assert.equal(c.snapshot().motoPassenger.contractReady,true);
 // The already-booked scope must not be reset by a same-session refresh.
 await c.refreshSession();assert.equal(s.gets(),1);
 assert.equal((await c.requestMotoQuote(intent)).ok,false);
});
test('F1 foreign Passenger saved key remains quarantined; no new quote or booking POST',async()=>{
 const s=scenario({saved:{version:1,ownerId:foreign,quoteId,
  bookingKey,cancellationKey:null,tripId:null,createdAt:T}}),c=s.client;
 s.setAuth(session(passenger));
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(c.snapshot().motoPassenger.contractReady,false);
 assert.equal(c.snapshot().motoPassenger.quote,null);
 assert.equal((await c.requestMotoQuote(intent)).ok,false);
 assert.equal(s.posts(),0);assert.equal(s.quotes(),0);assert.equal(s.gets(),0);
});
test('F1 locked native store or malformed server GET fails closed, never creates replacement trip',async()=>{
 for(const options of [
  {readError:true},
  {saved:{version:1,ownerId:passenger,quoteId,bookingKey,
    cancellationKey:null,tripId:null,createdAt:T},
   bookingRead:{...booking,ownerId:foreign}}
 ]){
  const s=scenario(options),c=s.client;
  s.setAuth(session());
  assert.equal((await c.refreshSession()).ok,true);
  assert.equal(c.snapshot().motoPassenger.contractReady,false);
  assert.equal((await c.requestMotoQuote(intent)).ok,false);
  assert.equal(s.posts(),0);assert.equal(s.quotes(),0);
 }
});
test('F1 changing Passenger identity clears previous booking and blocks foreign recovery',async()=>{
 const s=scenario({saved:{version:1,ownerId:passenger,quoteId,bookingKey,
  cancellationKey:null,tripId:null,createdAt:T}}),c=s.client;
 s.setAuth(session());await c.refreshSession();
 assert.equal(c.snapshot().motoPassenger.tripId,tripId);
 s.setAuth(session(foreign,jwt+'-other'));
 assert.equal((await c.refreshSession()).ok,true);
 assert.equal(c.snapshot().account.subject,foreign);
 assert.equal(c.snapshot().motoPassenger.contractReady,false);
 assert.equal(c.snapshot().motoPassenger.tripId,null);
 assert.equal(c.snapshot().motoPassenger.quote,null);
 assert.equal(s.posts(),0);
});
test('F1 sign-out purges secure recovery scope and a new login reboots cleanly',async()=>{
 const s=scenario(),c=s.client;s.setAuth(session());
 await c.refreshSession();
 assert.equal(c.snapshot().motoPassenger.contractReady,true);
 assert.equal((await c.signOut()).ok,true);
 assert.equal(s.purges(),1);
 assert.equal(c.snapshot().motoPassenger.contractReady,false);
 s.setAuth(session());
 await c.refreshSession();
 assert.equal(c.snapshot().motoPassenger.contractReady,true);
 assert.equal(s.reads(),2);
});
