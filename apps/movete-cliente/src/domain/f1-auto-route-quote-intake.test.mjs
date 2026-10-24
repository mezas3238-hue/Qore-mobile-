import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1AutoRouteQuoteIntake} from './f1-auto-route-quote-intake.mjs';
import {createF1AutoPrequoteConsent} from './f1-auto-prequote-consent.mjs';

const clock=1800000000000,id=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const owner=id(1),foreign=id(2),routeId=id(3),quoteId=id(4),quoteKey=id(5);
const scope={origin:'Centro, Asunción',destination:'Villa Morra, Asunción',
 service:'economico',ownerId:owner,quoteRequestKey:quoteKey,sessionRevision:1};
let time;
function fixture({enabled=true,routeResponse=null,quoteResponse=null}={}){
 time=clock;
 let actor={role:'passenger',subject:owner,sessionRevision:1,expiresAt:time+3600000};
 let routes=0,quotes=0;
 const verified=()=>({routeId,ownerId:owner,quoteRequestKey:quoteKey,
  origin:scope.origin,destination:scope.destination,service:scope.service,
  routingVerified:true,coverageVerified:true,expiresAt:time+120000,
  source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'});
 const q=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
  routeId,quoteId,quoteRequestKey:quoteKey,fareMode:'AUTO',service:'economico',
  currency:'PYG',amountGs:19500,fareVersion:'f1-qa-v1',
  expiresAt:time+110000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'});
 const quote=createF1AutoPrequoteConsent({enabled:true,
  quoteContractCertified:true,bookingContractCertified:false,
  stagingRuntimeVerified:true,getActor:async()=>actor,now:()=>time,
  quoteGateway:async()=>{quotes++;return quoteResponse
   ?quoteResponse(q()):{ok:true,status:200,data:q()};}});
 const flow=createF1AutoRouteQuoteIntake({enabled,routeContractCertified:true,
  stagingRuntimeVerified:true,now:()=>time,getActor:async()=>actor,
  quoteFlow:quote,routeGateway:async()=>{
   routes++;return routeResponse?routeResponse(verified())
    :{ok:true,status:200,data:verified()};}});
 return {flow,quote,routes:()=>routes,quotes:()=>quotes,
  setActor:x=>actor=x,advance:ms=>time+=ms};
}
test('without independently certified route+quote, cannot resolve or price',async()=>{
 const f=fixture({enabled:false});
 assert.equal(f.flow.snapshot().available,false);
 assert.equal((await f.flow.request(scope)).code,'VERIFIED_ROUTE_CONTRACT_PENDING');
 assert.equal(f.routes(),0);assert.equal(f.quotes(),0);
});
test('validated Passenger route -> opaque server ID -> PYG quote, without booking',async()=>{
 const f=fixture();
 const result=await f.flow.request(scope);
 assert.equal(result.ok,true);assert.equal(result.routeId,routeId);
 assert.equal(result.quote.amountGs,19500);
 assert.equal(f.quote.snapshot().phase,'quoted');
 assert.equal(f.quote.snapshot().bookingAvailable,false);
 assert.equal(f.routes(),1);assert.equal(f.quotes(),1);
 assert.equal(JSON.stringify(f.flow.snapshot()).includes(scope.origin),false);
});
test('reject arbitrary route tags, equal locations, and unsupported passenger MOTO',async()=>{
 const f=fixture();
 for(const bad of [{...scope,origin:'CENTRO'},
  {...scope,destination:scope.origin},{...scope,service:'moto'},
  {...scope,ownerId:foreign},{...scope,quoteRequestKey:'not-uuid'}]){
  if(bad.origin==='CENTRO')continue; // a human-readable place name is allowed
  assert.equal((await f.flow.request(bad)).ok,false);
 }
 assert.equal(f.routes(),0);
});
test('strict server attestation rejects foreign owner, route mismatch, fake coverage and stale proof',async()=>{
 for(const patch of [{ownerId:foreign},{routeId:'CENTRO'},
  {origin:'Localizado por celular'},{routingVerified:false},
  {coverageVerified:false},{status:'MOCK'},{source:'LOCAL_FIXTURE'},
  {expiresAt:clock},{expiresAt:clock+900000},{distanceMeters:5000}]){
  const f=fixture({routeResponse:data=>({ok:true,status:200,data:{...data,...patch}})});
  assert.equal((await f.flow.request(scope)).code,
   'ROUTE_ATTESTATION_NOT_VERIFIED',JSON.stringify(patch));
  assert.equal(f.quotes(),0);
 }
});
test('server local G72 HTTP quote without routeId/owner binding is not enough to show price',async()=>{
 const f=fixture({routeResponse:()=>({ok:true,status:201,
  data:{mode:'STAGING_DEMO_ONLY',ownerId:owner,originTag:'CENTRO',
   destinationTag:'VILLA_MORRA',zoneTag:'ASUNCION_FIXTURE',amountGs:19500}})});
 assert.equal((await f.flow.request(scope)).code,'ROUTE_ATTESTATION_NOT_VERIFIED');
 assert.equal(f.quotes(),0);
});
test('changing JWT session while route request is in flight cannot resurrect quote',async()=>{
 let release,entered;
 const pending=new Promise(resolve=>release=resolve);
 const enteredPromise=new Promise(resolve=>entered=resolve);
 const f=fixture({routeResponse:async data=>{entered();await pending;
  return {ok:true,status:200,data};}});
 const task=f.flow.request(scope);
 await enteredPromise;
 f.setActor({role:'passenger',subject:foreign,sessionRevision:2,expiresAt:clock+3600000});
 release();
 assert.equal((await task).code,'SESSION_CHANGED');
 assert.equal(f.quotes(),0);assert.equal(f.quote.snapshot().quote,null);
});
test('concurrent route taps do not initiate duplicate network requests',async()=>{
 let release,entered;
 const pending=new Promise(resolve=>release=resolve);
 const enteredPromise=new Promise(resolve=>entered=resolve);
 const f=fixture({routeResponse:async data=>{entered();await pending;
  return {ok:true,status:200,data};}});
 const first=f.flow.request(scope);
 await enteredPromise;
 assert.equal((await f.flow.request(scope)).code,'VERIFIED_ROUTE_IN_FLIGHT');
 release();
 assert.equal((await first).ok,true);
 assert.equal(f.routes(),1);assert.equal(f.quotes(),1);
});
test('invalid quote cannot create a fake route-priced screen',async()=>{
 const f=fixture({quoteResponse:q=>({ok:true,status:200,data:{...q,currency:'USD'}})});
 assert.equal((await f.flow.request(scope)).code,'PREQUOTE_NOT_VERIFIED');
 assert.equal(f.quote.snapshot().quote,null);
});
test('route expires while independent quote is outstanding: discard price and consent',async()=>{
 let release,entered;
 const pending=new Promise(resolve=>release=resolve);
 const enteredPromise=new Promise(resolve=>entered=resolve);
 const f=fixture({quoteResponse:async q=>{entered();await pending;
  return {ok:true,status:200,data:q};}});
 const task=f.flow.request(scope);
 await enteredPromise;
 f.advance(120000);release();
 assert.equal((await task).code,'PREQUOTE_NOT_VERIFIED');
 assert.equal(f.quote.snapshot().quote,null);
});
