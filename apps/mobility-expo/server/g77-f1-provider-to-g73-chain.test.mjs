import test from 'node:test';
import assert from 'node:assert/strict';
import {createG77VerifiedAutoRouteResolver} from './g77-f1-google-verified-route-resolver.mjs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';

/** G77 single coverage-FIRST independent authority -> Google Routes mock
 * -> exact G73 route/quote/booking/GET in one QA actor/trip.
 * No actual paid provider, production or external DB.
 */
const at=1900000000000;
const id=n=>'77770000-0000-4777-8777-'+String(n).padStart(12,'0');
const actor=id(1),routeId=id(2),routeKey=id(3),quoteKey=id(4),
 quoteId=id(5),bookKey=id(6),tripId=id(7),coverKey=id(8),tollKey=id(9);
const from='ChIJG77PYCENTROASUNCION',to='ChIJG77PYAEROPUERTOLUQUE';
const origin='Centro, Asunción',destination='Aeropuerto, Luque';
const token='g77-qa-passenger-token-abcdefghijklmnopqrstuvwxyz';
const headers={authorization:'Bearer '+token};
const resp=body=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(body)});
const cover=()=>({source:'INDEPENDENT_COVERAGE_AUTHORITY',
 coverageVerified:true,actorId:actor,origin,destination,
 service:'economico',evidenceId:coverKey,revision:4,
 verifiedAtMs:at-500,originPlaceId:from,destinationPlaceId:to,
 originTag:'CENTRO_ASUNCION',destinationTag:'AEROPUERTO_LUQUE',
 zoneTag:'ASUNCION_APPROVED_ZONE'});
function make({coverageApproved=true,tollVerified=true}={}){
 const events=[];let trip=null;
 const verified=createG77VerifiedAutoRouteResolver({
  apiKey:'test-private-google-key-NOT-REAL-123',
  tagSecret:'CI_ONLY_PRIVATE_TAG_SECRET_32_BYTES_NO_PRODUCTION',
  billableProviderApproved:true,now:()=>at,
  resolveCoveredPlaces:async()=>{
   events.push('coverage');return coverageApproved?cover():{...cover(),coverageVerified:false};
  },
  verifyRouteTolls:async scope=>{
   events.push('tolls');
   return {source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:tollVerified,
    evidenceId:tollKey,coverageEvidenceId:coverKey,
    originPlaceId:from,destinationPlaceId:to,
    distanceMeters:scope.distanceMeters,durationSeconds:scope.durationSeconds,
    tollsPyg:0,verifiedAtMs:at-400};
  },
  request:async(url,init)=>{
   events.push('google');
   assert.equal(url,'https://routes.googleapis.com/directions/v2:computeRoutes');
   assert.equal(init.method,'POST');
   assert.equal(JSON.parse(init.body).routingPreference,'TRAFFIC_AWARE');
   return resp({routes:[{distanceMeters:9800,duration:'900.5s'}]});
  }
 });
 const gateway=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:()=>at,
  verifyAccessToken:async raw=>{
   assert.equal(raw,token);
   return {id:actor,is_anonymous:false,email_confirmed_at:'2026-10-24T10:00:00Z'};
  },
  authorizePassenger:async()=>true,allowRequest:()=>true,
  resolveVerifiedRoute:verified,
  registerRoute:async input=>{
   events.push('register');
   assert.equal(input.actorId,actor);
   assert.equal(input.distanceMeters,9800);assert.equal(input.durationSeconds,901);
   assert.equal(input.tollsPyg,0);
   assert.match(input.originTag,/^LOC_[A-P]{32}$/);
   assert.match(input.destinationTag,/^LOC_[A-P]{32}$/);
   assert.notEqual(input.originTag,input.destinationTag);
   assert.equal(input.zoneTag,'ASUNCION_APPROVED_ZONE');
   return routeId;
  },
  loadRoute:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:actor,routeId,requestKey:routeKey,service:'economico',
   routingVerified:true,expiresAt:at+60000}),
  quoteRoute:async input=>{
   events.push('quote');
   assert.equal(input.actorId,actor);assert.equal(input.routeId,routeId);
   assert.equal(input.requestKey,quoteKey);return quoteId;
  },
  loadQuote:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:actor,routeId,quoteId,quoteRequestKey:quoteKey,
   fareMode:'AUTO',service:'economico',currency:'PYG',amountGs:17600,
   fareVersion:'g77-fixture',expiresAt:at+30000,
   serverPriced:true,routingVerified:true,status:'QUOTED_QA'}),
  bookQuote:async input=>{
   events.push('book');
   assert.equal(input.requestKey,bookKey);assert.equal(input.quoteId,quoteId);
   trip??=tripId;return trip;
  },
  reconcileBooking:async input=>{
   events.push('readback');
   assert.equal(input.actorId,actor);assert.equal(input.requestKey,bookKey);
   return trip===null?null:{mode:'STAGING_DEMO_ONLY',
    commercialEnabled:false,ownerId:actor,requestKey:bookKey,
    quoteId,routeId,tripId:trip,revision:1,
    serverPersisted:true,status:'ACCEPTED_QA'};
  }
 });
 return {gateway,events};
}
const routeReq=()=>({method:'POST',path:'/v1/staging/rider/auto/routes',
 headers,body:{quoteRequestKey:routeKey,origin,destination,service:'economico'}});
const quoteReq=()=>({method:'POST',path:'/v1/staging/rider/auto/prequote',
 headers,body:{requestKey:quoteKey,routeId}});
const bookReq=()=>({method:'POST',path:'/v1/staging/rider/auto/book',
 headers,body:{requestKey:bookKey,quoteId,accepted:true}});
test('G77 unique preflight-first provider→G73 route, server fare, one booking, GET',async()=>{
 const f=make();
 const route=await f.gateway(routeReq());
 assert.equal(route.status,200);assert.equal(route.body.routeId,routeId);
 const quote=await f.gateway(quoteReq());
 assert.equal(quote.status,200);assert.equal(quote.body.amountGs,17600);
 const book=await f.gateway(bookReq());
 assert.equal(book.status,201);assert.equal(book.body.tripId,tripId);
 const receipt=await f.gateway({method:'GET',
  path:'/v1/staging/rider/auto/bookings/'+bookKey,headers});
 assert.equal(receipt.status,200);assert.equal(receipt.body.tripId,tripId);
 assert.deepEqual(f.events.slice(0,6),[
  'coverage','google','tolls','register','quote','book']);
 assert.equal(f.events.filter(x=>x==='book').length,1);
 assert.equal(JSON.stringify(route.body).includes(from),false);
 assert.equal(JSON.stringify(route.body).includes(token),false);
});
test('G77 coverage rejection never bills; uncertified toll never registers DB route',async()=>{
 const noZone=make({coverageApproved:false});
 assert.equal((await noZone.gateway(routeReq())).status,409);
 assert.deepEqual(noZone.events,['coverage']);
 const noToll=make({tollVerified:false});
 assert.equal((await noToll.gateway(routeReq())).status,409);
 assert.deepEqual(noToll.events,['coverage','google','tolls']);
});
