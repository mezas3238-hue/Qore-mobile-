import test from 'node:test';
import assert from 'node:assert/strict';
import {createG101MotoPassengerHttpGateway} from './g101-moto-passenger-http-gateway.mjs';
import {createClientExperience} from './client-experience.mjs';
const now=1900000000000;
const id=n=>'10100000-0000-4101-8101-'+String(n).padStart(12,'0');
const owner=id(1),quoteId=id(2),quoteKey=id(3),campaignId=id(4),
 bookingKey=id(5),tripId=id(6),cancelKey=id(7),eventId=id(8),foreign=id(9);
const token='g101-qa-token-passenger-abcdefghijklmnopqrstuvwxyz';
const origin='https://movete-facil-staging.onrender.com';
const actor={subject:owner,role:'passenger',token,authRevision:1,
 sessionRevision:1,expiresAt:now+600000};
const quote={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,serviceKind:'MOTO_RIDE',service:'moto_pasajero',
 quoteId,quoteRequestKey:quoteKey,campaignId,currency:'PYG',
 amountGs:11000,commissionBps:1200,subsidyBps:1000,
 customerPaysGs:9900,customerSubsidyGs:1100,driverReceivesGs:9680,
 platformRetainsGs:220,expiresAt:now+240000,driverAssigned:false,
 pspCollected:false,serverPersisted:true};
const booking={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,serviceKind:'MOTO_RIDE',service:'moto_pasajero',
 bookingKey,quoteId,tripId,tripState:'searching',tripRevision:1,
 cancellationKey:null,cancellationEventId:null,currency:'PYG',
 amountGs:11000,customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,commissionBps:1200,subsidyBps:1000,
 financialState:'RESERVED_QA',reversalEntriesBalanced:false,
 driverAssigned:false,pspCollected:false,pspRefunded:false,serverPersisted:true};
const cancelled={...booking,tripState:'cancelled',tripRevision:2,
 cancellationKey:cancelKey,cancellationEventId:eventId,
 financialState:'VOIDED_QA',reversalEntriesBalanced:true};
const respond=(data,status=200,options={})=>({
 status,ok:status>=200&&status<300,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data),...options
});
const grants={enabled:true,contractCertified:true,externalRuntimeVerified:true,
 motoLegalVerified:true,motoRouteVerified:true,
 passengerRlsVerified:true,idempotencyVerified:true,origin,pinnedOrigin:origin};
const quoteScope={ownerId:owner,sessionRevision:1,quoteRequestKey:quoteKey,
 origin:'Centro de Asunción',destination:'Villa Morra',serviceKind:'MOTO_RIDE'};
const bookScope={ownerId:owner,sessionRevision:1,quoteId,bookingKey};
const cancelScope={ownerId:owner,sessionRevision:1,bookingKey,cancellationKey:cancelKey};
function setup({reply=null,config={},getActor=()=>actor}={}){
 const calls=[];
 const fetchImpl=async(url,request)=>{
  calls.push({path:new URL(url).pathname,request,url});
  if(reply)return reply(url,request,calls.length);
  const path=new URL(url).pathname;
  if(path.endsWith('/quotes'))return respond(quote);
  if(path.endsWith('/book'))return respond(booking,201);
  if(path.endsWith('/cancel')||path.endsWith('/cancellation'))return respond(cancelled);
  if(path.endsWith('/'+bookingKey))return respond(booking);
  throw Error('Unexpected G101 path');
 };
 const gateway=createG101MotoPassengerHttpGateway({
  ...grants,...config,getSession:getActor,fetchImpl,now:()=>now
 });
 return {gateway,calls,fetchImpl};
}
test('R79 G101 HTTP bridge is OFF by default and each missing external operator attestation',async()=>{
 assert.equal(createG101MotoPassengerHttpGateway().isConfigured(),false);
 for(const key of ['enabled','contractCertified','externalRuntimeVerified',
  'motoLegalVerified','motoRouteVerified','passengerRlsVerified',
  'idempotencyVerified']){
  const g=setup({config:{[key]:false}});assert.equal(g.gateway.isConfigured(),false,key);
  assert.equal(g.gateway.flowOptions(),null);
  assert.equal(g.calls.length,0);
 }
 for(const url of [
  'http://movete-facil-staging.onrender.com',
  'https://evil.invalid','https://localhost','https://127.0.0.1',
  'https://user:pass@movete-facil-staging.onrender.com',
  'https://movete-facil-staging.onrender.com:4000',
  'https://movete-facil-staging.onrender.com/private',
  'https://movete-facil-staging.onrender.com?token=1',
  'https://movete-facil-staging.onrender.com#frag'
 ]){
  const f=setup({config:{origin:url,pinnedOrigin:url}});
  assert.equal(f.gateway.isConfigured(),false,url);
 }
});
test('R79 all five G101 routes have strict methods, authenticated no-cache HTTPS, exact consent',async()=>{
 const f=setup(),opts=f.gateway.flowOptions();assert(opts);
 const qs=await opts.quoteGateway(quoteScope);
 assert.equal(qs.ok,true);assert.deepEqual(qs.data,quote);
 assert.equal((await opts.bookGateway(bookScope)).ok,true);
 assert.equal((await opts.bookingReadGateway(bookScope)).ok,true);
 assert.equal((await opts.cancelGateway(cancelScope)).ok,true);
 assert.equal((await opts.cancelReadGateway(cancelScope)).ok,true);
 assert.deepEqual(f.calls.map(x=>x.path),[
  '/v1/staging/rider/moto/quotes','/v1/staging/rider/moto/book',
  '/v1/staging/rider/moto/bookings/'+bookingKey,
  '/v1/staging/rider/moto/bookings/'+bookingKey+'/cancel',
  '/v1/staging/rider/moto/bookings/'+bookingKey+'/cancellation'
 ]);
 assert.deepEqual(f.calls.map(x=>x.request.method),['POST','POST','GET','POST','GET']);
 assert.deepEqual(JSON.parse(f.calls[0].request.body),{
  requestKey:quoteKey,origin:quoteScope.origin,destination:quoteScope.destination
 });
 assert.deepEqual(JSON.parse(f.calls[1].request.body),{
  requestKey:bookingKey,quoteId,accepted:true
 });
 assert.deepEqual(JSON.parse(f.calls[3].request.body),{
  requestKey:cancelKey,confirmed:true
 });
 for(const entry of f.calls){
  assert.equal(entry.request.credentials,'omit');
  assert.equal(entry.request.cache,'no-store');
  assert.equal(entry.request.redirect,'error');
  assert.equal(entry.request.headers.Authorization,'Bearer '+token);
  assert.equal(new URL(entry.url).origin,origin);
 }
 assert.equal(f.calls[2].request.body,undefined);
 assert.equal(f.calls[4].request.body,undefined);
});
test('R79 G101 never sends private network request with forged passenger owner or expired Auth',async()=>{
 const f=setup();
 const o=f.gateway.flowOptions();
 assert.equal((await o.quoteGateway({...quoteScope,ownerId:foreign})).code,
  'G101_INVALID_PRIVATE_SCOPE');
 assert.equal((await o.bookGateway({...bookScope,bookingKey:'bad'})).ok,false);
 assert.equal((await o.cancelGateway({...cancelScope,cancellationKey:bookingKey})).ok,false);
 assert.equal(f.calls.length,0);
 const expired=setup({getActor:()=>({...actor,expiresAt:now-1})});
 assert.equal((await expired.gateway.flowOptions().quoteGateway(quoteScope)).code,'AUTH_REQUIRED');
 assert.equal(expired.calls.length,0);
});
test('R79 rejects unexpected 200 book, redirect, HTML, excessive data and unauthorized 401',async()=>{
 const variants=[
  {reply:()=>respond(booking,200),kind:'book',code:'MOTO_BACKEND_UNAVAILABLE'},
  {reply:()=>respond(quote,200,{redirected:true}),kind:'quote',code:'UNTRUSTED_REDIRECT'},
  {reply:()=>respond(quote,200,{
   headers:{get:()=> 'text/html'}}),kind:'quote',code:'BAD_CONTENT_TYPE'},
  {reply:()=>respond(quote,200,{headers:{get:k=>k==='content-type'
    ?'application/json':k==='content-length'?'999999':null}}),
   kind:'quote',code:'RESPONSE_TOO_LARGE'},
  {reply:()=>respond({error:'bad'},503),kind:'quote',code:'SERVICE_UNAVAILABLE'}
 ];
 for(const v of variants){
  const f=setup({reply:v.reply});
  const opts=f.gateway.flowOptions();
  const result=v.kind==='book'
   ?await opts.bookGateway(bookScope):await opts.quoteGateway(quoteScope);
  assert.equal(result.code,v.code);
  assert.equal(f.calls.length,1);
 }
 let invalid=0;
 const f=setup({reply:()=>respond({},401)});
 const gateway=createG101MotoPassengerHttpGateway({
  ...grants,now:()=>now,getSession:()=>actor,
  fetchImpl:f.fetchImpl,onSessionInvalid:()=>{invalid++;}
 });
 assert.equal((await gateway.flowOptions().quoteGateway(quoteScope)).code,'AUTH_REQUIRED');
 assert.equal(invalid,1);
});
test('R79 ClientExperience may use G101 HTTP options, preserving exact G100 finance and one-shot cancellation',async()=>{
 const f=setup();
 const session={subject:owner,role:'passenger',token,expiresAt:now+600000};
 const client=createClientExperience({
  authProvider:{readSession:async()=>session,signOut:async()=>{}},
  motoPassengerHttpOptions:{...grants,fetchImpl:f.fetchImpl},
  now:()=>now
 });
 assert.equal((await client.refreshSession()).ok,true);
 assert.equal(client.snapshot().motoPassenger.contractReady,true);
 const args={origin:quoteScope.origin,destination:quoteScope.destination,
  quoteRequestKey:quoteKey,safetyAcknowledged:true};
 assert.equal((await client.requestMotoQuote(args)).ok,true);
 assert.equal(client.snapshot().motoPassenger.quote.customerPaysGs,9900);
 assert.equal(client.snapshot().motoPassenger.quote.platformRetainsGs,220);
 assert.equal(client.acceptMotoQuote({quoteId,customerPaysGs:9900}).ok,true);
 assert.equal((await client.bookMoto({bookingKey})).ok,true);
 assert.equal((await client.cancelMoto({cancellationKey:cancelKey})).ok,true);
 assert.equal(client.snapshot().motoPassenger.cancelled,true);
 assert.equal((await client.cancelMoto({cancellationKey:cancelKey})).ok,false);
 assert.deepEqual(f.calls.map(x=>x.request.method),['POST','POST','POST']);
 assert.equal(client.snapshot().motoPassenger.productionEnabled,false);
 await client.signOut();
 assert.equal(client.snapshot().motoPassenger.phase,'idle');
});
