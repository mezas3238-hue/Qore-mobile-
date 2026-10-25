import test from 'node:test';
import assert from 'node:assert/strict';
import {createG77VerifiedAutoRouteResolver} from './g77-f1-google-verified-route-resolver.mjs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
const AT=1900000000000;
const ACTOR='77770000-0000-4777-8777-000000000001';
const ROUTE='77770000-0000-4777-8777-000000000002';
const EVIDENCE='77770000-0000-4777-8777-000000000003';
const TOLLS='77770000-0000-4777-8777-000000000004';
const KEY='77770000-0000-4777-8777-000000000005';
const origin='Centro, Asunción',destination='Aeropuerto Silvio Pettirossi, Luque';
const scope={actorId:ACTOR,origin,destination,service:'economico'};
const coverage=()=>({actorId:ACTOR,origin,destination,service:'economico',
 source:'INDEPENDENT_COVERAGE_AUTHORITY',coverageVerified:true,
 evidenceId:EVIDENCE,revision:1,verifiedAtMs:AT-1000,
 originPlaceId:'ChIJVerifiedOriginAsuncion01',
 destinationPlaceId:'ChIJVerifiedDestinationLuque02',
 originTag:'CENTRO_ASUNCION',destinationTag:'AIRPORT_LUQUE',zoneTag:'ASUNCION_FIXTURE'});
const toll=(p={})=>({source:'INDEPENDENT_TOLL_AUTHORITY',
 tollsVerified:true,coverageEvidenceId:EVIDENCE,evidenceId:TOLLS,
 originPlaceId:coverage().originPlaceId,destinationPlaceId:coverage().destinationPlaceId,
 distanceMeters:5000,durationSeconds:600,tollsPyg:0,verifiedAtMs:AT-1000,...p});
const api=body=>({ok:true,status:200,redirected:false,
 headers:{get:()=>null},text:async()=>JSON.stringify(body)});
function scenario({covered=coverage(),charges=toll(),payload={routes:[{distanceMeters:5000,duration:'600s'}]},
 time=AT}={}){
 const requests=[],zones=[],chargeReads=[];
 const resolver=createG77VerifiedAutoRouteResolver({
  apiKey:'SERVER_ONLY_FAKE_KEY_NEVER_REAL_123456',
  billableProviderApproved:true,now:()=>time,
  resolveCoveredPlaces:async ctx=>{zones.push(ctx);return covered;},
  verifyRouteTolls:async proof=>{chargeReads.push(proof);return charges;},
  request:async(url,options)=>{requests.push({url,options});return api(payload);}
 });
 return {resolver,requests,zones,chargeReads};
}
test('G77 cannot instantiate billable API without explicit Owner billing approval',()=>{
 assert.throws(()=>createG77VerifiedAutoRouteResolver({
  apiKey:'SERVER_ONLY_FAKE_KEY_NEVER_REAL_123456',
  resolveCoveredPlaces:async()=>coverage(),verifyRouteTolls:async()=>toll()
 }),/not approved/i);
 assert.throws(()=>createG77VerifiedAutoRouteResolver({
  billableProviderApproved:true,apiKey:'bad',
  resolveCoveredPlaces:async()=>coverage(),verifyRouteTolls:async()=>toll()
 }),/private API/);
});
test('G77 only routes Place IDs after independent coverage and toll verification',async()=>{
 const f=scenario();
 const receipt=await f.resolver(scope);
 assert.deepEqual(receipt,{routingVerified:true,coverageVerified:true,
  trafficAware:true,fallbackUsed:false,originTag:'CENTRO_ASUNCION',
  destinationTag:'AIRPORT_LUQUE',zoneTag:'ASUNCION_FIXTURE',
  distanceMeters:5000,durationSeconds:600,tollsPyg:0});
 assert.equal(f.requests.length,1);
 assert.equal(f.zones.length,1);assert.deepEqual(f.zones[0],scope);
 assert.equal(f.chargeReads.length,1);
 const post=f.requests[0];
 assert.equal(post.url,'https://routes.googleapis.com/directions/v2:computeRoutes');
 assert.equal(post.options.method,'POST');
 assert.equal(post.options.redirect,'error');
 assert.equal(post.options.headers['X-Goog-FieldMask'],
  'routes.distanceMeters,routes.duration,fallbackInfo');
 const payload=JSON.parse(post.options.body);
 assert.deepEqual(payload.origin,{placeId:coverage().originPlaceId});
 assert.deepEqual(payload.destination,{placeId:coverage().destinationPlaceId});
 assert.equal(payload.routingPreference,'TRAFFIC_AWARE');
 assert.equal(payload.computeAlternativeRoutes,false);
 assert.equal(payload.travelMode,'DRIVE');
 assert.equal(payload.regionCode,'py');
 assert.equal(post.options.body.includes(origin),false,
  'never send raw typed addresses to billing provider');
});
test('G77 rejects wrong owner, stale zone, ambiguous place, forged coverage before paid call',async()=>{
 const proofs=[
  {...coverage(),actorId:'77770000-0000-4777-8777-000000000099'},
  {...coverage(),coverageVerified:false},
  {...coverage(),source:'CLIENT_ASSERTED_COVERAGE'},
  {...coverage(),verifiedAtMs:AT-60001},
  {...coverage(),originPlaceId:coverage().destinationPlaceId},
  {...coverage(),zoneTag:'pague'},
  {...coverage(),service:'xl'}
 ];
 for(const covered of proofs){
  const f=scenario({covered});
  await assert.rejects(f.resolver(scope),/coverage/i);
  assert.equal(f.requests.length,0,'do not bill when area is not verified');
  assert.equal(f.chargeReads.length,0);
 }
});
test('G77 refuses traffic fallback, multiple routes, invalid duration and oversized response',async()=>{
 const cases=[
  {fallbackInfo:{routingMode:'FALLBACK_TRAFFIC_UNAWARE'},routes:[{distanceMeters:5000,duration:'600s'}]},
  {routes:[{distanceMeters:5000,duration:'600s'},{distanceMeters:3000,duration:'500s'}]},
  {routes:[{distanceMeters:5000,duration:'bogus'}]},
  {routes:[{distanceMeters:0,duration:'600s'}]},
  {routes:[]}
 ];
 for(const payload of cases){
  const f=scenario({payload});
  await assert.rejects(f.resolver(scope));
  assert.equal(f.chargeReads.length,0);
 }
 const blocked=scenario();
 // No real network request. Oversized provider stub must be rejected early.
 const denied=createG77VerifiedAutoRouteResolver({
  apiKey:'SERVER_ONLY_FAKE_KEY_NEVER_REAL_123456',
  billableProviderApproved:true,now:()=>AT,
  resolveCoveredPlaces:async()=>coverage(),verifyRouteTolls:async()=>toll(),
  request:async()=>({ok:true,status:200,redirected:false,
   headers:{get:k=>k==='content-length'?'900000':null},
   text:async()=>{throw Error('must not stream giant body');}})
 });
 await assert.rejects(denied(scope),/too large/);
 assert.equal(blocked.requests.length,0);
});
test('G77 rejects any guessed zero toll, old proof or mismatched road data',async()=>{
 for(const p of [
  {tollsVerified:false},{source:'CLIENT_TOLLS'},
  {coverageEvidenceId:TOLLS},{distanceMeters:10},{durationSeconds:1},
  {verifiedAtMs:AT-70000},{tollsPyg:-1},{tollsPyg:1000001}
 ]){
  const f=scenario({charges:toll(p)});
  await assert.rejects(f.resolver(scope),/tolls/i);
  assert.equal(f.requests.length,1);
 }
});
test('G77 source-backed route flows into G73 without local price or invented availability',async()=>{
 const f=scenario();
 const gateway=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async()=>({id:ACTOR,is_anonymous:false,
   email_confirmed_at:'2026-10-24T00:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:()=>true,
  resolveVerifiedRoute:f.resolver,
  registerRoute:async r=>{
   assert.equal(r.distanceMeters,5000);assert.equal(r.tollsPyg,0);
   assert.equal(r.originTag,'CENTRO_ASUNCION');return ROUTE;
  },
  loadRoute:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:ACTOR,routeId:ROUTE,requestKey:KEY,service:'economico',
   routingVerified:true,expiresAt:AT+120000}),
  quoteRoute:async()=>{throw Error('Quote not configured')},
  loadQuote:async()=>null,bookQuote:async()=>{throw Error('Booking not configured')},
  reconcileBooking:async()=>null,now:()=>AT
 });
 const result=await gateway({
  method:'POST',path:'/v1/staging/rider/auto/routes',
  headers:{authorization:'Bearer fake_server_verified_token_123456789012345'},
  body:{quoteRequestKey:KEY,origin,destination,service:'economico'}
 });
 assert.equal(result.status,200);
 assert.equal(result.body.routeId,ROUTE);
 assert.equal(result.body.routingVerified,true);
 assert.equal(result.body.coverageVerified,true);
 assert.equal(result.body.origin,origin);
 assert.equal(f.requests.length,1);
});
