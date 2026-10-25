import test from 'node:test';
import assert from 'node:assert/strict';
import {createG77GoogleF1VerifiedRoute} from './g77-google-f1-verified-route.mjs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';

/** G77 independently verified Google address/route/zone/tolls -> G73 SQL
 * route registration -> authoritative quote -> one booking -> same-key GET.
 * Still a deterministic NO-PAID-CALL QA transport, no HTTPS deployment.
 */
const now=1900000000000;
const id=n=>'77770000-0000-4777-8777-'+String(n).padStart(12,'0');
const actor=id(1),routeId=id(2),routeKey=id(3),quoteKey=id(4),
 quoteId=id(5),bookKey=id(6),tripId=id(7);
const from='ChIJG77PYCENTROASUNCION';
const to='ChIJG77PYAEROPUERTOLUQUE';
const origin='Centro, Asunción',destination='Aeropuerto, Luque';
const token='g77-qa-passenger-token-abcdefghijklmnopqrstuvwxyz';
const headers={authorization:'Bearer '+token};
const reply=data=>({ok:true,status:200,redirected:false,
 headers:{get:x=>x==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const geo=(placeId,lat,lon)=>({results:[{placeId,granularity:'ROOFTOP',
 postalAddress:{regionCode:'PY'},location:{latitude:lat,longitude:lon}}]});
function make({coverageApproved=true,tollVerified=true}={}){
 const events=[];
 let addr=0,trip=null;
 const verified=createG77GoogleF1VerifiedRoute({
  enabled:true,billingApproved:true,apiKey:'test-private-google-key-NOT-REAL-123',
  tagSecret:'CI_ONLY_HMAC_TAG_SECRET_DIFFERENT_FROM_REAL_CREDENTIALS',
  now:()=>now,
  request:async(url,init)=>{
   events.push('google');
   if(init.method==='GET')return reply(++addr===1
    ?geo(from,-25.29,-57.63):geo(to,-25.25,-57.52));
   assert.equal(init.method,'POST');
   return reply({routes:[{distanceMeters:9800,duration:'900.5s'}]});
  },
  authorizeCoverage:async input=>{
   events.push('zone');return {
    verified:true,approved:coverageApproved,country:'PY',
    originPlaceId:input.from.placeId,destinationPlaceId:input.to.placeId,
    zoneTag:'ASUNCION_APPROVED_ZONE',service:'economico',revision:1
   };
  },
  verifyTolls:async input=>{
   events.push('tolls');
   return {verified:tollVerified,originPlaceId:input.originPlaceId,
    destinationPlaceId:input.destinationPlaceId,
    zoneTag:input.zoneTag,distanceMeters:input.distanceMeters,
    tollsPyg:0};
  }
 });
 const gateway=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:()=>now,
  verifyAccessToken:async raw=>{
   assert.equal(raw,token);
   return {id:actor,is_anonymous:false,email_confirmed_at:'2026-10-24T10:00:00Z'};
  },
  authorizePassenger:async()=>true,allowRequest:()=>true,
  resolveVerifiedRoute:verified,
  registerRoute:async input=>{
   events.push('register');
   assert.equal(input.actorId,actor);
   assert.equal(input.distanceMeters,9800);
   assert.equal(input.durationSeconds,901);
   assert.equal(input.tollsPyg,0);
   assert.match(input.originTag,/^LOC_[A-P]{32}$/);
   assert.match(input.destinationTag,/^LOC_[A-P]{32}$/);
   assert.notEqual(input.originTag,input.destinationTag);
   assert.equal(input.zoneTag,'ASUNCION_APPROVED_ZONE');
   return routeId;
  },
  loadRoute:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:actor,routeId,requestKey:routeKey,service:'economico',
   routingVerified:true,expiresAt:now+60000}),
  quoteRoute:async input=>{
   events.push('quote');
   assert.equal(input.actorId,actor);assert.equal(input.routeId,routeId);
   assert.equal(input.requestKey,quoteKey);
   return quoteId;
  },
  loadQuote:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:actor,routeId,quoteId,quoteRequestKey:quoteKey,
   fareMode:'AUTO',service:'economico',currency:'PYG',
   amountGs:17600,fareVersion:'g77-fixture',
   expiresAt:now+30000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'}),
  bookQuote:async input=>{
   events.push('book');
   assert.equal(input.requestKey,bookKey);assert.equal(input.quoteId,quoteId);
   if(trip===null)trip=tripId;
   return trip;
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
test('G77 paid opt-in ONLY synthetic adapter -> G73 route/quote/book/GET same trip, price server-only',async()=>{
 const f=make();
 const r=await f.gateway(routeReq());
 assert.equal(r.status,200);assert.equal(r.body.routeId,routeId);
 assert.equal(r.body.routingVerified,true);
 const q=await f.gateway(quoteReq());
 assert.equal(q.status,200);assert.equal(q.body.amountGs,17600);
 const b=await f.gateway(bookReq());
 assert.equal(b.status,201);assert.equal(b.body.tripId,tripId);
 const get=await f.gateway({method:'GET',
  path:'/v1/staging/rider/auto/bookings/'+bookKey,headers});
 assert.equal(get.status,200);assert.equal(get.body.tripId,tripId);
 assert.equal(f.events.filter(x=>x==='book').length,1);
 assert.deepEqual(f.events.slice(0,7),
  ['google','google','google','zone','tolls','register','quote']);
 assert.equal(JSON.stringify(r.body).includes(from),false);
 assert.equal(JSON.stringify(r.body).includes('apiKey'),false);
});
test('G77 unauthorised zone or uncertain tolls stop route BEFORE G73 DB register/quote/book',async()=>{
 for(const settings of [{coverageApproved:false},{tollVerified:false}]){
  const f=make(settings);
  const r=await f.gateway(routeReq());
  assert.equal(r.status,409);
  assert.equal(f.events.includes('register'),false);
  assert.equal(f.events.includes('quote'),false);
  assert.equal(f.events.includes('book'),false);
 }
});
