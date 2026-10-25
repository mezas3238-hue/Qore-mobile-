import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1G73HttpGateway} from './f1-g73-http-gateway.mjs';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'f1750000-0000-4150-8150-'+String(n).padStart(12,'0');
const USER=id(1),OTHER=id(2),ROUTE=id(3),QUOTE=id(4),
 QKEY=id(5),BKEY=id(6),TRIP=id(7);
const TOKEN='qa-user-verified-bearer-abcdefghijklmnopqrstuvwxyz';
const ORIGIN='https://qa.example.invalid';
const INTENT={origin:'Centro, Asunción',destination:'Villa Morra, Asunción',
 service:'economico',quoteRequestKey:QKEY};
const route=()=>({routeId:ROUTE,ownerId:USER,quoteRequestKey:QKEY,
 origin:INTENT.origin,destination:INTENT.destination,
 service:'economico',routingVerified:true,coverageVerified:true,
 expiresAt:T+120000,source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'});
const quote=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:USER,
 routeId:ROUTE,quoteId:QUOTE,quoteRequestKey:QKEY,fareMode:'AUTO',service:'economico',
 currency:'PYG',amountGs:19000,fareVersion:'qa-g73-f1',
 expiresAt:T+110000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'});
const booking=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:USER,requestKey:BKEY,quoteId:QUOTE,routeId:ROUTE,
 tripId:TRIP,revision:1,serverPersisted:true,status:'ACCEPTED_QA'});
const reply=(data,status=200)=>({
 ok:status>=200&&status<300,status,redirected:false,
 headers:{get:key=>key==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)
});
const flags={enabled:true,contractCertified:true,
 stagingRuntimeVerified:true,routeProviderCertified:true,
 origin:ORIGIN,pinnedOrigin:ORIGIN};
const httpActor=()=>({role:'passenger',subject:USER,token:TOKEN,
 authRevision:1,sessionRevision:1,expiresAt:T+3600000});
const scoped={ownerId:USER,sessionRevision:1};
const rScope={...INTENT,...scoped};
const qScope={routeId:ROUTE,quoteRequestKey:QKEY,service:'economico',...scoped};
const bScope={requestKey:BKEY,routeId:ROUTE,quoteId:QUOTE,
 fareVersion:'qa-g73-f1',service:'economico',...scoped};
const cScope={requestKey:BKEY,routeId:ROUTE,quoteId:QUOTE,...scoped};
function direct(extra={}){
 let auth=httpActor(),history=[],count=0;
 const api=createF1G73HttpGateway({
  ...flags,getSession:async()=>auth,now:()=>T,
  fetchImpl:async(url,req)=>{
   count++;history.push({url,req});
   if(url.endsWith('/routes'))return reply(route());
   if(url.endsWith('/prequote'))return reply(quote());
   if(url.endsWith('/book'))return reply(booking(),201);
   if(url.endsWith('/bookings/'+BKEY))return reply(booking());
   return reply({error:'not found'},404);
  },...extra
 });
 return {api,history,count:()=>count,rotate:s=>{auth=s;}};
}

test('G73 disabled by default, no unpinned origin, no network',async()=>{
 const f=direct({enabled:false,fetchImpl:async()=>{throw Error('cannot fetch')}});
 assert.equal(f.api.isConfigured(),false);
 assert.equal((await f.api.resolveRoute(rScope)).code,'G73_STAGING_NOT_CERTIFIED');
 for(const raw of ['http://qa.example.invalid','https://qa.example.invalid:444',
  'https://qa.example.invalid/path','https://user:pass@qa.example.invalid']){
  assert.equal(direct({origin:raw,pinnedOrigin:raw}).api.isConfigured(),false);
 }
 const wrong=direct({pinnedOrigin:'https://other.example.invalid'});
 assert.equal(wrong.api.isConfigured(),false);
});
test('G73 sends four exact API operations, no client price and GET without body',async()=>{
 const f=direct();
 assert.equal((await f.api.resolveRoute(rScope)).ok,true);
 assert.equal((await f.api.readQuote(qScope)).ok,true);
 assert.equal((await f.api.bookQuote(bScope)).ok,true);
 assert.equal((await f.api.reconcile(cScope)).ok,true);
 assert.deepEqual(f.history.map(x=>x.req.method),['POST','POST','POST','GET']);
 assert.deepEqual(f.history.map(x=>new URL(x.url).pathname),[
  '/v1/staging/rider/auto/routes','/v1/staging/rider/auto/prequote',
  '/v1/staging/rider/auto/book','/v1/staging/rider/auto/bookings/'+BKEY]);
 assert.deepEqual(f.history.slice(0,3).map(x=>JSON.parse(x.req.body)),[
  {quoteRequestKey:QKEY,origin:INTENT.origin,destination:INTENT.destination,service:'economico'},
  {requestKey:QKEY,routeId:ROUTE},
  {requestKey:BKEY,quoteId:QUOTE,accepted:true}
 ]);
 assert.equal(f.history[3].req.body,undefined);
 assert(f.history.every(x=>x.req.headers.Authorization==='Bearer '+TOKEN));
 assert(f.history.every(x=>x.req.credentials==='omit'&&x.req.redirect==='error'));
 assert.equal(f.api.productionEnabled,false);
});
test('G73 rejects tampered route, price, booking and foreign reconciliation',async()=>{
 for(const [path,alter,scope,method] of [
  ['routes',()=>({...route(),ownerId:OTHER}),rScope,'resolveRoute'],
  ['routes',()=>({...route(),coverageVerified:false}),rScope,'resolveRoute'],
  ['prequote',()=>({...quote(),amountGs:1,commercialEnabled:true}),qScope,'readQuote'],
  ['prequote',()=>({...quote(),routeId:OTHER}),qScope,'readQuote'],
  ['book',()=>({...booking(),ownerId:OTHER}),bScope,'bookQuote'],
  ['book',()=>({...booking(),amountGs:500}),bScope,'bookQuote'],
  ['bookings',()=>({...booking(),requestKey:QKEY}),cScope,'reconcile']
 ]){
  const f=direct({fetchImpl:async()=>reply(alter(),path==='book'?201:200)});
  const result=await f.api[method](scope);
  assert.equal(result.ok,false,path+' must reject tamper');
  assert.equal(result.code,'G73_RECEIPT_NOT_VERIFIED');
 }
});
test('G73 JWT rotation while route fetch is pending discards result',async()=>{
 let release;
 let signal;
 const pending=new Promise(resolve=>release=resolve);
 const entered=new Promise(resolve=>signal=resolve);
 const f=direct({fetchImpl:async()=>{
  signal();await pending;return reply(route());
 }});
 const task=f.api.resolveRoute(rScope);
 await entered;
 f.rotate({...httpActor(),token:'new-verified-bearer-abcdefghijklmnopqrstuvwxyz'});
 release();
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
});
test('G73 validates scope before any HTTP, and one in-flight call blocks second',async()=>{
 let release,signal;
 const pending=new Promise(resolve=>release=resolve);
 const entered=new Promise(resolve=>signal=resolve);
 const f=direct({fetchImpl:async()=>{signal();await pending;return reply(route());}});
 assert.equal((await f.api.resolveRoute({...rScope,origin:' Centro '})).code,'INVALID_G73_SCOPE');
 const first=f.api.resolveRoute(rScope);
 await entered;
 assert.equal((await f.api.bookQuote(bScope)).code,'G73_REQUEST_IN_FLIGHT');
 release();
 assert.equal((await first).ok,true);
});
function composed({lostAck=false,foreignGet=false}={}){
 let actor={role:'passenger',subject:USER,token:TOKEN,expiresAt:T+3600000};
 const history=[];
 const client=createClientExperience({
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  now:()=>T,
  autoG73HttpOptions:{...flags,fetchImpl:async(url,request)=>{
   const path=new URL(url).pathname;
   history.push({path,method:request.method});
   if(path.endsWith('/routes'))return reply(route());
   if(path.endsWith('/prequote'))return reply(quote());
   if(path.endsWith('/book')){
    if(lostAck)return reply({error:'offline'},503);
    return reply(booking(),201);
   }
   if(path.endsWith('/bookings/'+BKEY)){
    return reply(foreignGet?{...booking(),ownerId:OTHER}:booking());
   }
   return reply({error:'none'},404);
  }}
 });
 return {client,history,setActor:a=>{actor=a;}};
}
test('Client F1 G73 integration: route -> quote -> explicit consent -> one booking',async()=>{
 const {client,history}=composed();
 assert.equal((await client.refreshSession()).ok,true);
 assert.equal((await client.requestAutoQuote(INTENT)).ok,true);
 const price=client.snapshot().autoPrequote;
 assert.equal(price.phase,'quoted');
 assert.equal(price.quote.amountGs,19000);
 assert.equal(client.acceptAutoPrequote({quoteId:QUOTE,amountGs:19000,
  fareVersion:'qa-g73-f1'}).ok,true);
 const booked=await client.reserveQuotedAuto({requestKey:BKEY});
 assert.equal(booked.ok,true);
 assert.equal(booked.tripId,TRIP);
 assert.equal(history.filter(x=>x.path.endsWith('/book')).length,1);
 assert.equal(client.snapshot().autoPrequote.tripId,TRIP);
 // Booking evidence alone is NOT authorization for status/GPS tracking.
 assert.equal(client.snapshot().rideContinuation.canVerify,false);
 assert.equal(client.snapshot().rideContinuation.productionEnabled,false);
});
test('Client F1 G73 lost POST ACK recovers via owner-scoped GET only',async()=>{
 const {client,history}=composed({lostAck:true});
 await client.refreshSession();
 assert.equal((await client.requestAutoQuote(INTENT)).ok,true);
 assert.equal(client.acceptAutoPrequote({quoteId:QUOTE,amountGs:19000,
  fareVersion:'qa-g73-f1'}).ok,true);
 assert.equal((await client.reserveQuotedAuto({requestKey:BKEY})).code,
  'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal((await client.reconcileQuotedAuto()).recoveredWithoutPost,true);
 assert.equal(client.snapshot().autoPrequote.tripId,TRIP);
 assert.equal(client.snapshot().rideContinuation.canVerify,false);
 assert.equal(history.filter(x=>x.path.endsWith('/book')).length,1);
 assert.equal(history.filter(x=>x.path.endsWith('/bookings/'+BKEY)).length,1);
});
test('Client F1 G73 foreign recovery cannot unlock trip, no repeated booking',async()=>{
 const {client,history}=composed({lostAck:true,foreignGet:true});
 await client.refreshSession();
 assert.equal((await client.requestAutoQuote(INTENT)).ok,true);
 client.acceptAutoPrequote({quoteId:QUOTE,amountGs:19000,
  fareVersion:'qa-g73-f1'});
 await client.reserveQuotedAuto({requestKey:BKEY});
 assert.equal((await client.reconcileQuotedAuto()).code,'BOOKING_STILL_UNCONFIRMED');
 assert.equal(client.snapshot().rideContinuation.canVerify,false);
 assert.equal(history.filter(x=>x.path.endsWith('/book')).length,1);
});
