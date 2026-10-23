import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL(
 '../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
test('G45 endpoints cannot be mistaken for mounted payment/checkout HTTP',()=>{
 assert.ok(/^1\\.0\\.0-g(?:45|4[6-9]|[5-9][0-9])$/.test(spec.info.version));
 assert.equal(spec['x-qore-live-enabled'],false);
 for(const [path,method,bodySchema,receiptSchema,status] of [
  ['/v1/staging/buyer/orders/reservations-g45','post','BuyerReserveOrderG45','BuyerReserveReceiptG45','201'],
  ['/v1/staging/buyer/orders/{orderId}/cancel-reservation-g45','post','BuyerCancelOrderG45','BuyerCancelReceiptG45','200']
 ]){
  const o=spec.paths[path]?.[method];
  assert.ok(o,path);
  assert.equal(o['x-qore-runtime-wired'],false);
  assert.equal(o['x-qore-qa-only'],true);
  assert.equal(o.requestBody.content['application/json'].schema.$ref,'#/components/schemas/'+bodySchema);
  assert.equal(o.responses[status].content['application/json'].schema.$ref,'#/components/schemas/'+receiptSchema);
  for(const code of ['400','401','403','409','429','503'])
   assert.equal(o.responses[code].$ref,'#/components/responses/Error');
  assert.equal(spec.components.schemas[bodySchema].additionalProperties,false);
  assert.equal(spec.components.schemas[receiptSchema].additionalProperties,false);
  assert.equal(spec.components.schemas[receiptSchema].properties.orderEnabled.const,false);
  assert.equal(spec.components.schemas[receiptSchema].properties.productionEnabled.const,false);
 }
 assert.deepEqual(spec.components.schemas.BuyerReserveOrderG45.required,
  ['requestKey','branchId','catalogVersion','vehicleKind','items']);
 for(const disallowed of ['subtotalPyg','unitPricePyg','buyerId',
  'paymentMethod','liveEnabled','discountPyg'])
  assert.equal(spec.components.schemas.BuyerReserveOrderG45.properties[disallowed],undefined);
 assert.equal(spec.components.schemas.BuyerReserveOrderG45.properties.items.maxItems,50);
 assert.equal(spec.components.schemas.BuyerReserveOrderG45.properties.vehicleKind.const,'AUTO');
 assert.equal(spec.components.schemas.BuyerCancelReceiptG45.properties.refundStatus.const,
  'NO_PSP_NO_FINANCIAL_REFUND');
});
