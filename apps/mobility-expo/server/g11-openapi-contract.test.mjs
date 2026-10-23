import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL(
 '../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
const transport=readFileSync(new URL('./g4-loopback-http-transport.mjs',import.meta.url),'utf8');
const runtimePaths=[
 '/v1/staging/rider/trips/request','/v1/staging/rider/trips/{tripId}/status',
 '/v1/staging/rider/trips/{tripId}/cancel','/v1/staging/rider/history',
 '/v1/staging/driver/inbox',
 '/v1/staging/driver/license-readiness',
 '/v1/staging/driver/enrollment',
 '/v1/staging/driver/documents',
 '/v1/staging/driver/documents/observe',
 '/v1/staging/admin/driver-documents/review',
 '/v1/staging/driver/offers/{offerId}','/v1/staging/driver/offers/accept',
 '/v1/staging/driver/offers/decline','/v1/staging/trips/{tripId}/transition',
 '/v1/staging/sender/deliveries/request','/v1/staging/deliveries/{deliveryId}/transition',
 '/v1/staging/deliveries/{deliveryId}/status',
 '/v1/staging/courier/delivery-offers',
 '/v1/staging/courier/delivery-offers/{offerId}',
 '/v1/staging/courier/delivery-offers/accept',
 '/v1/staging/courier/delivery-offers/decline','/v1/staging/buyer/orders/request',
 '/v1/staging/merchant/orders/{orderId}/transition',
 '/v1/staging/buyer/orders/{orderId}/transition',
 '/v1/staging/merchant/orders/{orderId}/attach-delivery',
 '/v1/staging/orders/{orderId}/status','/v1/staging/fares/quote',
 '/v1/staging/payments/authorize','/v1/staging/payments/{paymentId}/transition',
 '/v1/staging/payments/{paymentId}/status','/v1/staging/safety/incidents/report',
 '/v1/staging/safety/incidents/{incidentId}/status',
 '/v1/staging/admin/safety/incidents/{incidentId}/transition',
 '/v1/staging/admin/safety/suspensions/apply',
 '/v1/staging/admin/safety/suspensions/{suspensionId}/lift',
 '/v1/staging/merchant/onboarding/request',
 '/v1/staging/admin/merchants/{merchantId}/review',
 '/v1/staging/merchant/branches/upsert','/v1/staging/merchant/catalog/upsert',
];
test('G11 OpenAPI is parseable, versioned, localhost STAGING and never LIVE',()=>{
 assert.equal(spec.openapi,'3.1.0');assert.match(spec.info.version,/^1\\.0\\.0-g\\d+$/);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.deepEqual(spec.security,[{BearerAuth:[]}]);
 assert.equal(spec.components.securitySchemes.BearerAuth.scheme,'bearer');
 assert.ok(spec.servers.every(server=>server.url.startsWith('http://127.0.0.1:')));
 assert.doesNotMatch(JSON.stringify(spec.servers),/supabase|lovable|production|https:/i);
});
test('every authenticated runtime route is represented with unique operation and response',()=>{
 assert.deepEqual(runtimePaths.filter(path=>!spec.paths[path]),[]);
 const operationIds=[];
 for(const [path,item] of Object.entries(spec.paths)){
  assert.match(path,/^\/v1\/staging\//);
  for(const [method,operation] of Object.entries(item)){
   assert.ok(['get','post'].includes(method));
   assert.equal(typeof operation.operationId,'string');
   assert.ok(operation.responses.default);operationIds.push(operation.operationId);
  }
 }
 assert.equal(new Set(operationIds).size,operationIds.length);
});
test('all client request objects are sealed and never accept derived identity, price or route truth',()=>{
 const forbidden=new Set(['actorId','ownerId','courierId','driverId','senderId','buyerId',
  'customerId','amountPyg','commissionBps','distanceMeters','durationSeconds','tollsPyg',
  'liveEnabled','role']);
 for(const [name,request] of Object.entries(spec.components.requestBodies)){
  assert.equal(request.required,true,name);
  const ref=request.content?.['application/json']?.schema?.$ref;
  assert.match(ref??'',/^#\/components\/schemas\//,name);
  const schema=spec.components.schemas[ref.split('/').at(-1)];
  const variants=schema.oneOf??[schema];
  for(const variant of variants){
   assert.equal(variant.type,'object',name);
   assert.equal(variant.additionalProperties,false,name);
   for(const field of Object.keys(variant.properties??{}))
    assert.equal(forbidden.has(field),false,`${name}.${field} must be server-derived`);
  }
 }
});
test('G10 removes direct acceptance by delivery ID from transport and interface contract',()=>{
 assert.equal(spec.paths['/v1/staging/courier/deliveries/{deliveryId}/accept'],undefined);
 assert.doesNotMatch(transport,/deliveryAcceptRoute/);
 assert.match(transport,/deliveryOfferDecisionRoute/);
});

test('G24/G25/G26 public Client DTOs are versioned, auth-bound, and sealed',()=>{
 for(const [path,method,schema] of [
  ['/v1/staging/fares/quote','post','ServerPricedQuoteV1'],
  ['/v1/staging/rider/trips/{tripId}/cancel','post','RideCancellationReceiptV1'],
  ['/v1/staging/rider/history','get','RiderOwnHistoryV1']
 ]){
  const operation=spec.paths[path]?.[method];
  assert.ok(operation,`missing ${path}`);
  const success=method==='post'&&path.includes('quote')?'201':'200';
  assert.equal(operation.responses[success]?.content?.['application/json']?.schema?.$ref,
   '#/components/schemas/'+schema);
  assert.equal(spec.components.schemas[schema].additionalProperties,false);
  assert.ok(operation.responses['401']&&operation.responses['403']&&
   operation.responses['503'],`${path}: fail-closed Auth/infra response required`);
 }
 assert.deepEqual(spec.components.schemas.RiderOwnHistoryV1.properties.nextCursor.type,['string','null']);
 assert.ok(spec.paths['/v1/staging/rider/history'].get.parameters.some(p=>p.name==='X-Qore-History-Cursor'));
 assert.equal(spec.paths['/v1/staging/rider/history'].get.responses['400'].$ref,'#/components/responses/Error');
 assert.equal(spec.components.schemas.RideCancellationV1.additionalProperties,false);
});
