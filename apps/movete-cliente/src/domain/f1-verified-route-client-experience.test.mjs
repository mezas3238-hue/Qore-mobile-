import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
const t=1800000000000,id=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),routeId=id(3),quoteId=id(4),key=id(5);
const intent={origin:'Centro, Asunción',destination:'Villa Morra, Asunción',
 service:'economico',quoteRequestKey:key};
function setup({routeOverride=null,quoteOverride=null,ready=true}={}){
 let actor={role:'passenger',subject:owner,
  token:'synthetic-passenger-JWT-abcdefghijklmnop',expiresAt:t+3600000};
 let routes=0,quotes=0,bookings=0;
 const app=createClientExperience({
  now:()=>t,
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  autoRouteIntakeOptions:{
   enabled:ready,routeContractCertified:true,stagingRuntimeVerified:true,
   routeGateway:async scope=>{
    routes++;assert.equal(scope.ownerId,owner);
    const data={routeId,ownerId:owner,quoteRequestKey:key,
     origin:intent.origin,destination:intent.destination,service:intent.service,
     routingVerified:true,coverageVerified:true,expiresAt:t+120000,
     source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'};
    return routeOverride?routeOverride(data):{ok:true,status:200,data};
   }
  },
  autoPrequoteOptions:{
   enabled:true,quoteContractCertified:true,bookingContractCertified:false,
   stagingRuntimeVerified:true,
   quoteGateway:async scope=>{
    quotes++;assert.equal(scope.routeId,routeId);
    assert.equal(scope.ownerId,owner);assert.equal(scope.quoteRequestKey,key);
    const data={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
     ownerId:owner,routeId,quoteId,quoteRequestKey:key,fareMode:'AUTO',
     service:'economico',currency:'PYG',amountGs:18500,
     fareVersion:'server-qa-v1',expiresAt:t+110000,serverPriced:true,
     routingVerified:true,status:'QUOTED_QA'};
    return quoteOverride?quoteOverride(data):{ok:true,status:200,data};
   },
   bookingGateway:async()=>{bookings++;throw Error('must not book');}
  }
 });
 return {app,routes:()=>routes,quotes:()=>quotes,bookings:()=>bookings,
  setActor:x=>actor=x,getActor:()=>actor};
}
test('Client default never resolves human addresses or fetches price',async()=>{
 const c=createClientExperience();
 assert.equal(c.snapshot().autoRouteQuote.available,false);
 assert.equal((await c.requestAutoQuote(intent)).code,'AUTH_REQUIRED');
 const f=setup({ready:false});await f.app.refreshSession();
 assert.equal(f.app.snapshot().autoRouteQuote.available,false);
 assert.equal((await f.app.requestAutoQuote(intent)).code,'VERIFIED_ROUTE_CONTRACT_PENDING');
 assert.equal(f.routes(),0);assert.equal(f.quotes(),0);
});
test('own human directions -> A route attestation -> B quote PYG shown but no booking',async()=>{
 const f=setup();await f.app.refreshSession();
 const s=f.app.snapshot();
 assert.equal(s.autoRouteQuote.available,true);
 assert.equal((await f.app.requestAutoQuote(intent)).ok,true);
 assert.equal(f.app.snapshot().autoPrequote.phase,'quoted');
 assert.equal(f.app.snapshot().autoPrequote.quote.amountGs,18500);
 assert.equal(f.app.snapshot().autoPrequote.canReserve,false);
 assert.equal(f.app.snapshot().tracking.tripId,null);
 assert.equal(f.app.snapshot().rideContinuation.canVerify,false);
 assert.equal(f.routes(),1);assert.equal(f.quotes(),1);assert.equal(f.bookings(),0);
 const projection=JSON.stringify(f.app.snapshot());
 assert.equal(projection.includes(intent.origin),false);
 assert.equal(projection.includes(f.getActor().token),false);
});
test('one quote at a time and local prepared ride cannot race prequote',async()=>{
 const f=setup();await f.app.refreshSession();
 assert.equal(f.app.prepareRide({requestKey:id(9),originTag:'CENTRO',
  destinationTag:'SHOPPING',service:'economico'}).ok,true);
 assert.equal((await f.app.requestAutoQuote(intent)).code,'AUTO_QUOTE_CONFLICT');
 assert.equal(f.routes(),0);
 f.app.discardPreparedMutation({operation:'rideRequest',requestKey:id(9)});
 assert.equal((await f.app.requestAutoQuote(intent)).ok,true);
 assert.equal((await f.app.requestAutoQuote({...intent,quoteRequestKey:id(10)})).code,
  'AUTO_QUOTE_CONFLICT');
 assert.equal(f.routes(),1);assert.equal(f.quotes(),1);
});
test('foreign route or G72 unversioned quote is rejected; no fake PYG',async()=>{
 const foreign=setup({routeOverride:data=>({ok:true,status:200,data:{...data,ownerId:other}})});
 await foreign.app.refreshSession();
 assert.equal((await foreign.app.requestAutoQuote(intent)).code,'ROUTE_ATTESTATION_NOT_VERIFIED');
 assert.equal(foreign.quotes(),0);
 const g72=setup({quoteOverride:()=>({ok:true,status:201,
  data:{quoteId,requestKey:key,amountGs:18500,currency:'PYG'}})});
 await g72.app.refreshSession();
 assert.equal((await g72.app.requestAutoQuote(intent)).code,'PREQUOTE_NOT_VERIFIED');
 assert.equal(g72.app.snapshot().autoPrequote.quote,null);
 assert.equal(g72.bookings(),0);
});
test('rotation of JWT clears previously validated quote and retry is not automatic',async()=>{
 const f=setup();await f.app.refreshSession();
 await f.app.requestAutoQuote(intent);
 f.setActor({...f.getActor(),token:'rotated-passenger-JWT-abcdefghijklmnop'});
 assert.equal((await f.app.refreshSession()).ok,true);
 assert.equal(f.app.snapshot().autoPrequote.quote,null);
 assert.equal(f.app.snapshot().autoPrequote.phase,'idle');
 assert.equal(f.routes(),1);assert.equal(f.quotes(),1);
});
