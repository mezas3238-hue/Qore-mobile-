import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1G73HttpGateway} from './f1-g73-http-gateway.mjs';
const time=1900000000000,id=n=>'73730000-0000-4737-8737-'+String(n).padStart(12,'0');
const owner=id(1),foreign=id(2),routeId=id(3),quoteId=id(4),key=id(5),bookingKey=id(6),tripId=id(7);
const routeScope={ownerId:owner,sessionRevision:1,quoteRequestKey:key,
 origin:'Panteón',destination:'Aeropuerto',service:'economico'};
const quoteScope={ownerId:owner,sessionRevision:1,quoteRequestKey:key,
 routeId,service:'economico'};
const bookScope={ownerId:owner,sessionRevision:1,requestKey:bookingKey,
 quoteId,routeId,fareVersion:'g73-qa-v1',service:'economico'};
const reconcileScope={ownerId:owner,sessionRevision:1,
 requestKey:bookingKey,quoteId,routeId};
const route=()=>({routeId,ownerId:owner,quoteRequestKey:key,
 origin:'Panteón',destination:'Aeropuerto',service:'economico',
 routingVerified:true,coverageVerified:true,expiresAt:time+300000,
 source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'});
const quote=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,routeId,quoteId,quoteRequestKey:key,fareMode:'AUTO',
 service:'economico',currency:'PYG',amountGs:15200,fareVersion:'g73-qa-v1',
 expiresAt:time+120000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'});
const booked=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,requestKey:bookingKey,quoteId,routeId,tripId,
 revision:1,serverPersisted:true,status:'ACCEPTED_QA'});
const reply=(data,status=200,patch={})=>({
 ok:status>=200&&status<300,redirected:false,status,
 headers:{get:n=>n==='content-type'?'application/json':n==='content-length'?null:null},
 text:async()=>JSON.stringify(data),...patch
});
function fixture({wire=null,enabled=true,origin='https://qa.example.invalid',
 pin='https://qa.example.invalid',routeProviderCertified=true}={}){
 let actor={role:'passenger',subject:owner,authRevision:1,
  sessionRevision:1,expiresAt:time+600000,token:'qa-passenger-verified-token-abcdefghij'};
 const calls=[];
 const gateway=createF1G73HttpGateway({
  enabled,contractCertified:true,stagingRuntimeVerified:true,
  routeProviderCertified,origin,pinnedOrigin:pin,now:()=>time,
  getSession:async()=>actor,
  fetchImpl:async(url,init)=>{
   calls.push({url,init});
   if(wire)return wire(url,init);
   if(url.endsWith('/routes'))return reply(route());
   if(url.endsWith('/prequote'))return reply(quote());
   if(url.endsWith('/book'))return reply(booked(),201);
   if(url.endsWith('/bookings/'+bookingKey))return reply(booked());
   throw Error('unsupported path');
  }
 });
 return {gateway,calls,rotate:x=>actor=x,actor:()=>actor};
}
test('G73 remains completely off without explicit HTTPS, route provider and all staging gates',async()=>{
 const cases=[fixture({enabled:false}),
  fixture({pin:'https://other.example.invalid'}),
  fixture({origin:'http://qa.example.invalid',pin:'http://qa.example.invalid'}),
  fixture({routeProviderCertified:false}),
  fixture({origin:'https://qa.example.invalid/a',pin:'https://qa.example.invalid/a'})];
 for(const f of cases){
  assert.equal(f.gateway.isConfigured(),false);
  assert.equal((await f.gateway.resolveRoute(routeScope)).code,'G73_STAGING_NOT_CERTIFIED');
  assert.equal(f.calls.length,0);
 }
});
test('canonical A G73 four-operation HTTP contract, one bearer and zero local price',async()=>{
 const f=fixture();
 assert.equal(f.gateway.isConfigured(),true);
 assert.equal((await f.gateway.resolveRoute(routeScope)).data.routeId,routeId);
 assert.equal((await f.gateway.readQuote(quoteScope)).data.amountGs,15200);
 assert.equal((await f.gateway.bookQuote(bookScope)).data.tripId,tripId);
 assert.equal((await f.gateway.reconcile(reconcileScope)).data.tripId,tripId);
 assert.deepEqual(f.calls.map(x=>x.init.method),['POST','POST','POST','GET']);
 assert.deepEqual(f.calls.map(x=>new URL(x.url).pathname),[
  '/v1/staging/rider/auto/routes',
  '/v1/staging/rider/auto/prequote',
  '/v1/staging/rider/auto/book',
  '/v1/staging/rider/auto/bookings/'+bookingKey
 ]);
 assert.deepEqual(f.calls.slice(0,3).map(x=>JSON.parse(x.init.body)),[
  {quoteRequestKey:key,origin:'Panteón',destination:'Aeropuerto',service:'economico'},
  {requestKey:key,routeId},
  {requestKey:bookingKey,quoteId,accepted:true}
 ]);
 assert.equal(f.calls[3].init.body,undefined);
 assert(f.calls.every(x=>x.init.headers.Authorization.startsWith('Bearer ')));
 assert(f.calls.every(x=>x.init.credentials==='omit'&&x.init.redirect==='error'));
 assert.equal(f.calls.some(x=>String(x.init.body).includes('amountGs')),false);
});
test('cross-owner, wrong route, extra fields or altered quote/currency never reach view',async()=>{
 const perturb=[
  {value:{...route(),ownerId:foreign},kind:'route',scope:routeScope},
  {value:{...route(),distanceMeters:100},kind:'route',scope:routeScope},
  {value:{...quote(),routeId:foreign},kind:'quote',scope:quoteScope},
  {value:{...quote(),currency:'USD'},kind:'quote',scope:quoteScope},
  {value:{...quote(),commercialEnabled:true},kind:'quote',scope:quoteScope},
  {value:{...booked(),ownerId:foreign},kind:'book',scope:bookScope},
  {value:{...booked(),quoteId:foreign},kind:'reconcile',scope:reconcileScope}
 ];
 for(const p of perturb){
  const f=fixture({wire:()=>reply(p.value,p.kind==='book'?201:200)});
  const result=await (p.kind==='route'?f.gateway.resolveRoute(p.scope):
   p.kind==='quote'?f.gateway.readQuote(p.scope):
   p.kind==='book'?f.gateway.bookQuote(p.scope):
    f.gateway.reconcile(p.scope));
  assert.equal(result.code,'G73_RECEIPT_NOT_VERIFIED',p.kind);
 }
});
test('expired route quote, duplicate key and foreign Passenger are rejected before booking POST',async()=>{
 const f=fixture();
 assert.equal((await f.gateway.bookQuote({...bookScope,requestKey:key,ownerId:foreign})).code,'STALE_SESSION_RESPONSE');
 assert.equal((await f.gateway.resolveRoute({...routeScope,origin:'  untrimmed'})).code,'INVALID_G73_SCOPE');
 assert.equal((await f.gateway.readQuote({...quoteScope,routeId:'bad'})).code,'INVALID_G73_SCOPE');
 const expired=fixture({wire:(url)=>reply(url.endsWith('/routes')
  ?{...route(),expiresAt:time-1}:{...quote(),expiresAt:time-1})});
 assert.equal((await expired.gateway.resolveRoute(routeScope)).code,'G73_RECEIPT_NOT_VERIFIED');
 assert.equal((await expired.gateway.readQuote(quoteScope)).code,'G73_RECEIPT_NOT_VERIFIED');
 assert.equal(f.calls.length,0);
});
test('HTTP 404 reconciliation is NEVER an excuse to repeat booking POST',async()=>{
 const f=fixture({wire:(url)=>url.endsWith('/bookings/'+bookingKey)
  ?reply({error:'private'},404):reply(booked(),201)});
 const rec=await f.gateway.reconcile(reconcileScope);
 assert.equal(rec.ok,false);assert.equal(rec.code,'NOT_FOUND');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].init.method,'GET');
});
test('401/403, 409, 429, 503 and redirects are sanitized, no server messages leaked',async()=>{
 for(const code of [401,403,409,429,503]){
  const f=fixture({wire:()=>reply({token:'private-secret'},code)});
  const result=await f.gateway.resolveRoute(routeScope);
  assert.equal(result.ok,false);
  assert.equal(JSON.stringify(result).includes('private-secret'),false);
  assert.equal(f.calls.length,1);
 }
 const f=fixture({wire:()=>reply(route(),200,{redirected:true})});
 assert.equal((await f.gateway.resolveRoute(routeScope)).code,'UNTRUSTED_REDIRECT');
});
test('JSON body limit, incorrect MIME and raw private DTO must fail closed',async()=>{
 const f=fixture({wire:()=>reply(route(),200,{headers:{get:name=>
  name==='content-type'?'text/plain':null}})});
 assert.equal((await f.gateway.resolveRoute(routeScope)).code,'BAD_CONTENT_TYPE');
 const huge=fixture({wire:()=>reply(route(),200,{headers:{get:name=>
  name==='content-type'?'application/json':name==='content-length'?'100000000':null}})});
 assert.equal((await huge.gateway.resolveRoute(routeScope)).code,'RESPONSE_TOO_LARGE');
});
test('JWT rotation during response makes it stale and cancels prior owner evidence',async()=>{
 let release,entered;
 const signal=new Promise(resolve=>release=resolve);
 const begun=new Promise(resolve=>entered=resolve);
 const f=fixture({wire:async()=>{entered();await signal;return reply(route());}});
 const pending=f.gateway.resolveRoute(routeScope);
 await begun;
 f.rotate({...f.actor(),token:'rotated-qa-passenger-token-abcdefghijklmnop'});
 release();
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
});
test('logout cancels in-flight request, no second concurrent request or stale result',async()=>{
 let release,entered;
 const waiting=new Promise(resolve=>release=resolve);
 const begun=new Promise(resolve=>entered=resolve);
 const f=fixture({wire:async()=>{entered();await waiting;return reply(route());}});
 const pending=f.gateway.resolveRoute(routeScope);
 await begun;
 assert.equal((await f.gateway.resolveRoute(routeScope)).code,'G73_REQUEST_IN_FLIGHT');
 f.gateway.cancelPending();
 release();
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(f.calls.length,1);
});

const dispatchScope={ownerId:owner,sessionRevision:1,requestKey:bookingKey,tripId};
const dispatchDto=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,bookingKey,tripId,tripState:'searching',
 dispatchState:'OFFER_PENDING',attempts:1,offerPendingAcceptance:true});
test('R67 G90 reads owner-bound Driver search state over same pinned HTTPS without new booking',async()=>{
 const f=fixture({wire:()=>reply(dispatchDto())});
 const r=await f.gateway.readDispatch(dispatchScope);
 assert.equal(r.ok,true);assert.deepEqual(r.data,dispatchDto());
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].init.method,'GET');
 assert.equal(new URL(f.calls[0].url).pathname,
  '/v1/staging/rider/auto/bookings/'+bookingKey+'/dispatch');
 assert.equal(f.calls[0].init.body,undefined);
 assert.equal(f.calls[0].init.credentials,'omit');
 assert.equal(f.calls[0].init.headers.Authorization.startsWith('Bearer '),true);
 assert.equal(JSON.stringify(r).includes('driverId'),false);
});
test('R67 G90 fails closed on forged passenger/trip, arbitrary fields, invalid assignment and unpinned runtime',async()=>{
 for(const bad of [
  {...dispatchDto(),ownerId:foreign},
  {...dispatchDto(),tripId:foreign},
  {...dispatchDto(),driverId:foreign},
  {...dispatchDto(),dispatchState:'OFFER_PENDING',offerPendingAcceptance:false},
  {...dispatchDto(),dispatchState:'CLOSED'},
  {...dispatchDto(),attempts:13},
  {...dispatchDto(),tripState:'accepted'},
  {...dispatchDto(),commercialEnabled:true}
 ]){
  const f=fixture({wire:()=>reply(bad)});
  assert.equal((await f.gateway.readDispatch(dispatchScope)).code,'G73_RECEIPT_NOT_VERIFIED');
 }
 const f=fixture();
 assert.equal((await f.gateway.readDispatch({...dispatchScope,tripId:foreign})).code,
  'G73_RECEIPT_NOT_VERIFIED'); // Backend fixture does not support G90.
 assert.equal((await f.gateway.readDispatch({...dispatchScope,requestKey:'forged'})).code,
  'INVALID_G73_SCOPE');
 assert.equal((await f.gateway.readDispatch({...dispatchScope,ownerId:foreign})).code,
  'STALE_SESSION_RESPONSE');
 assert.equal((await fixture({enabled:false}).gateway.readDispatch(dispatchScope)).code,
  'G73_STAGING_NOT_CERTIFIED');
});
