import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../docs/backend/',import.meta.url);
const spec=JSON.parse(readFileSync(new URL('openapi/movete-facil-staging.openapi.json',base),'utf8'));
const path='/v1/staging/sender/deliveries/{deliveryId}/custody';
test('G69 G68 sender status is documented without ever enabling runtime or production',()=>{
 assert.match(spec.info.version,/^1\.0\.0-g\d+$/);
 assert.ok(Number(spec.info.version.split('-g')[1])>=69);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-g68-sender-custody-runtime-wired'],false);
 const endpoint=spec.paths[path]?.get;
 assert.ok(endpoint);
 assert.equal(endpoint.operationId,'getPrivateSenderOwnedDeliveryCustodyG68');
 assert.equal(endpoint['x-qore-runtime-wired'],false);
 assert.equal(endpoint['x-qore-qa-only'],true);
 assert.equal(endpoint['x-qore-g69-delegated-exchange-ready-in-ci'],true);
 assert.deepEqual(endpoint.security,[{BearerAuth:[]}]);
 assert.deepEqual(endpoint.parameters,[{
  name:'deliveryId',in:'path',required:true,
  schema:{type:'string',format:'uuid'}
 }]);
 for(const status of ['200','400','401','403','404','429','503','default'])
  assert.ok(endpoint.responses[status],status);
 assert.equal(endpoint.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/SenderOwnedDeliveryCustodyG68');
});
test('G69 B R65 consumes an exact sealed DTO without courier, proof or financial PII',()=>{
 const dto=spec.components.schemas.SenderOwnedDeliveryCustodyG68;
 assert.equal(dto.type,'object');
 assert.equal(dto.additionalProperties,false);
 assert.deepEqual(dto.required,['mode','deliveryId','ownerId','state','revision',
  'vehicleKind','assignmentPersisted','proofVerified','qaOnly',
  'productionEnabled','liveDeliveriesEnabled']);
 assert.deepEqual(dto.properties.state.enum,
  ['requested','accepted','picked_up','delivered','disputed','returned','cancelled']);
 assert.deepEqual(dto.properties.vehicleKind.enum,['AUTO','MOTO']);
 assert.equal(dto.properties.mode.const,'STAGING_DEMO_ONLY');
 assert.equal(dto.properties.qaOnly.const,true);
 assert.equal(dto.properties.productionEnabled.const,false);
 assert.equal(dto.properties.liveDeliveriesEnabled.const,false);
 for(const key of ['courierId','driverId','proofRef','senderPhone','phone',
  'gps','latitude','longitude','location','payment','price','content_sha256']){
  assert.equal(dto.properties[key],undefined,key);
 }
});
test('G69 openapi does not document public proof minting or delegated SQL endpoint',()=>{
 assert.equal(spec.paths['/v1/staging/sender/deliveries/{deliveryId}/custody/proof'],undefined);
 assert.equal(spec.paths['/v1/staging/sender/proof-mint'],undefined);
 assert.equal(spec.paths['/v1/staging/sql/g69/exchange'],undefined);
 const method=spec.paths[path].get;
 assert.equal(method.requestBody,undefined);
 assert.deepEqual(Object.keys(spec.paths[path]),['get']);
});
