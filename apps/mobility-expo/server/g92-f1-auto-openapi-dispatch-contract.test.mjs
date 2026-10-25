import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
const spec=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
const refs=[
 ['/v1/staging/rider/auto/routes','post','G73VerifiedRouteReceipt','G73RouteRequest','200'],
 ['/v1/staging/rider/auto/prequote','post','G73PrequoteReceipt','G73PrequoteRequest','200'],
 ['/v1/staging/rider/auto/book','post','G73BookingReceipt','G73BookRequest','201'],
 ['/v1/staging/rider/auto/bookings/{bookingKey}','get','G73BookingReceipt',null,'200'],
 ['/v1/staging/rider/auto/bookings/{bookingKey}/dispatch','get','G90PrivateDispatchReceipt',null,'200']
];
test('F1 G73/G90 are fully versioned, synthetic, private and without a false commercial claim',()=>{
 assert.equal(spec.info.version,'1.0.0-g92');
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-f1-auto-external-staging-certified'],false);
 assert.equal(spec['x-qore-f1-auto-native-certified'],false);
 for(const [path,verb,out,input,success] of refs){
  const route=spec.paths[path]?.[verb];assert.ok(route,path);
  assert.deepEqual(route.security,[{BearerAuth:[]}]);
  assert.equal(route['x-qore-runtime-wired'],false);
  assert.equal(route['x-qore-external-https-certified'],false);
  assert.equal(route.responses[success].content['application/json'].schema.$ref,'#/components/schemas/'+out);
  for(const status of ['401','403','409','429','503','default']) assert.ok(route.responses[status],path+' '+status);
  if(input)assert.equal(route.requestBody?.content['application/json'].schema.$ref,'#/components/schemas/'+input);
  else {assert.equal(route.requestBody,undefined);assert.equal(route.parameters[0].name,'bookingKey');}
  const dto=spec.components.schemas[out];
  assert.equal(dto.additionalProperties,false);
  assert.deepEqual(dto.required,Object.keys(dto.properties));
 }
});
test('G90 fields exactly match B R67 consumer; no driver, offer, GPS or speculative ETA',()=>{
 const dto=spec.components.schemas.G90PrivateDispatchReceipt;
 assert.deepEqual(dto.required,['mode','commercialEnabled','ownerId','bookingKey','tripId','tripState','dispatchState','attempts','offerPendingAcceptance']);
 assert.deepEqual(dto.properties.dispatchState.enum,['SEARCHING_DRIVER','OFFER_PENDING','RETRY_PENDING','SEARCH_EXHAUSTED','CLOSED']);
 for(const name of ['driverId','offerId','driverPhone','gps','latitude','longitude','eta','vehiclePlate','pushToken'])
  assert.equal(dto.properties[name],undefined,name);
 for(const name of ['G73RouteRequest','G73PrequoteRequest','G73BookRequest']){
  const props=spec.components.schemas[name];
  assert.equal(props.additionalProperties,false);
  for(const key of ['ownerId','driverId','amountGs','role','commercialEnabled'])
   assert.equal(props.properties[key],undefined,name+'.'+key);
 }
});
test('G90 temporary SQL outage is 503, absent booking 404, contradictory receipt 409',async()=>{
 const uid='73730000-0000-4737-8737-000000000001',key='73730000-0000-4737-8737-000000000012';
 const query={method:'GET',path:'/v1/staging/rider/auto/bookings/'+key+'/dispatch',
  headers:{authorization:'Bearer '+'z'.repeat(40)}};
 const base={projectRef:'staging1234567890abcd',
  verifyAccessToken:async()=>({id:uid,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:()=>true,
  resolveVerifiedRoute:async()=>{},registerRoute:async()=>{},loadRoute:async()=>{},
  quoteRoute:async()=>{},loadQuote:async()=>{},bookQuote:async()=>{},reconcileBooking:async()=>{}};
 const run=async readDispatchStatus=>createQoreG73AutoGateway({...base,readDispatchStatus})(query);
 const unavailable=await run(async()=>{throw Error('TOP_SECRET_DATABASE_HOST');});
 assert.deepEqual(unavailable,{status:503,body:{error:'Private dispatch status unavailable'}});
 assert.doesNotMatch(JSON.stringify(unavailable),/TOP_SECRET_DATABASE_HOST/);
 assert.equal((await run(async()=>null)).status,404);
 assert.equal((await run(async()=>({driverId:'untrusted'}))).status,409);
});
