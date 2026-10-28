import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const ID=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const owner=ID(1),routeId=ID(3),quoteId=ID(4),quoteRequestKey=ID(5);
const requestKey=ID(6),tripId=ID(7),now=1800000000000;
const quote={
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
 routeId,quoteId,quoteRequestKey,fareMode:'AUTO',
 service:'economico',currency:'PYG',amountGs:19000,
 fareVersion:'qa-v1',expiresAt:now+120000,
 serverPriced:true,routingVerified:true,status:'QUOTED_QA'
};
const booking={
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
 requestKey,quoteId,routeId,tripId,revision:1,
 serverPersisted:true,status:'ACCEPTED_QA'
};
function create({certified=true,book=true}={}){
 let posts=0,quotes=0;
 const c=createClientExperience({
  now:()=>now,
  authProvider:{readSession:async()=>({
   role:'passenger',subject:owner,token:'signed-qa-passenger-jwt-abcdefghijklmn',
   expiresAt:now+3600000}),signOut:async()=>{}},
  autoPrequoteOptions:{
   enabled:certified,quoteContractCertified:certified,
   stagingRuntimeVerified:certified,bookingContractCertified:book,
   reconciliationContractCertified:false,
   quoteGateway:async scope=>{quotes++;
    assert.equal(scope.routeId,routeId);assert.equal(scope.ownerId,owner);
    return {ok:true,status:200,data:quote};},
   bookingGateway:async scope=>{posts++;
    assert.equal(scope.quoteId,quoteId);
    assert.equal(scope.routeId,routeId);
    assert.equal(scope.requestKey,requestKey);
    assert.equal(scope.amountGs,undefined);
    return {ok:true,status:201,data:booking};}
  }
 });
 return {c,posts:()=>posts,quotes:()=>quotes};
}
test('Cliente default: quote-before-dispatch path is off with no app configuration',async()=>{
 const c=createClientExperience();
 const s=c.snapshot();
 assert.equal(s.autoPrequote.quoteAvailable,false);
 assert.equal(s.autoPrequote.quote,null);
 assert.equal(c.prepareAutoPrequote({routeId}).code,'PREQUOTE_BACKEND_NOT_CERTIFIED');
});
test('Cliente quote-only: server fare may be shown and explicitly accepted, but cannot book',async()=>{
 const f=create({book:false}),c=f.c;
 assert.equal((await c.refreshSession()).ok,true);
 const privacy=c.snapshot().privateViewRevision;
 const args={ownerId:owner,sessionRevision:privacy,routeId,
  service:'economico',quoteRequestKey};
 assert.equal(c.prepareAutoPrequote(args).ok,true);
 assert.equal((await c.loadAutoPrequote()).ok,true);
 assert.equal(c.snapshot().autoPrequote.quote.amountGs,19000);
 assert.equal(c.snapshot().autoPrequote.canAccept,true);
 assert.equal(c.acceptAutoPrequote({quoteId,amountGs:19000,fareVersion:'qa-v1'}).ok,true);
 assert.equal(c.snapshot().autoPrequote.canReserve,false);
 assert.equal((await c.reserveQuotedAuto({requestKey})).code,'QUOTE_BOUND_BOOKING_NOT_CERTIFIED');
 assert.equal(f.posts(),0);assert.equal(f.quotes(),1);
 c.clear();
 assert.equal(c.snapshot().autoPrequote.quote,null);
 assert.equal(c.snapshot().autoPrequote.tripId,null);
});
test('Cliente QA booking via new flow cannot counterfeit old tracking, Driver assignment or PSP',async()=>{
 const f=create(),c=f.c;
 await c.refreshSession();
 const prep=c.prepareAutoPrequote({
  ownerId:owner,sessionRevision:c.snapshot().privateViewRevision,
  routeId,service:'economico',quoteRequestKey
 });
 assert.equal(prep.ok,true);
 await c.loadAutoPrequote();
 assert.equal(c.acceptAutoPrequote({quoteId,amountGs:19000,fareVersion:'qa-v1'}).ok,true);
 assert.equal((await c.reserveQuotedAuto({requestKey})).ok,true);
 const s=c.snapshot();
 assert.equal(s.autoPrequote.tripId,tripId);
 assert.equal(s.autoPrequote.productionEnabled,false);
 assert.equal(s.rideContinuation.canVerify,false);
 assert.equal(s.tracking.tripId,null);
 assert.equal(s.tracking.assignedDriver,null);
 assert.equal(s.quote,null);
 assert.equal(f.posts(),1);
});
