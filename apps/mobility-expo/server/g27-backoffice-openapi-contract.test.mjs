import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api=JSON.parse(readFileSync(new URL(
 '../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
const defs=[
 ['/v1/staging/admin/vehicle-review-queue','admin','admin.kyc.read','BackofficeKycPageA05'],
 ['/v1/staging/admin/zones/overview','admin','admin.zones.read','BackofficeZonePageA05'],
 ['/v1/staging/admin/incidents/queue','admin','admin.incidents.read','BackofficeIncidentPageA05'],
 ['/v1/staging/admin/audit/events','admin','admin.audit.read','BackofficeAuditPageA05'],
 ['/v1/staging/owner/finance/summary','owner','owner.finance.read','BackofficeOwnerFinanceA05']
];
test('A05 OpenAPI declares all five B frontend paths and unmounted server-only security gates',()=>{
 for(const [path,role,permission,schema] of defs){
  const op=api.paths[path]?.get;
  assert.ok(op,path);
  assert.equal(op['x-qore-qa-only'],true);
  assert.equal(op['x-qore-runtime-wired'],false);
  assert.equal(op['x-qore-role'],role);
  assert.equal(op['x-qore-permission'],permission);
  assert.deepEqual(op.security,[{BearerAuth:[]}]);
  for(const status of [200,400,401,403,429,503])
   assert.ok(op.responses[String(status)],path+' missing '+status);
  assert.equal(op.responses['200'].content['application/json'].schema.$ref,
   '#/components/schemas/'+schema);
  assert.equal(api.components.schemas[schema].additionalProperties,false);
  if(role==='admin'){
   assert.equal(op.parameters.length,1);
   assert.equal(op.parameters[0].name,'cursor');
   assert.equal(api.components.schemas[schema].properties.items.maxItems,50);
   assert.equal(api.components.schemas[schema].properties.nextCursor.oneOf[0].maxLength,256);
  }else{
   assert.equal(op.parameters,undefined);
   assert.ok(!Object.hasOwn(api.components.schemas[schema].properties,'items'));
  }
 }
});
test('A05 OpenAPI field allowlist excludes KYC documents, personal identity and financial detail',()=>{
 const requiredRows=[
  'BackofficeKycRowA05','BackofficeZoneRowA05',
  'BackofficeIncidentRowA05','BackofficeAuditRowA05'
 ];
 for(const key of requiredRows){
  const x=api.components.schemas[key];
  assert.equal(x.additionalProperties,false);
  assert.deepEqual(new Set(x.required),new Set(Object.keys(x.properties)));
  for(const forbidden of ['driverName','email','phone','documentUrl',
   'licensePhoto','bankAccount','serviceKey','password','latitude','longitude'])
   assert.ok(!Object.hasOwn(x.properties,forbidden),key+' exposes '+forbidden);
 }
 const finance=api.components.schemas.BackofficeOwnerFinanceA05;
 assert.equal(finance.properties.totals.additionalProperties,false);
 assert.ok(finance.properties.totals.properties.netPlatformGs);
 assert.ok(!finance.properties.totals.properties.driverName);
});
test('A05 50-page size is a transport limit; no total historical record count maximum',()=>{
 for(const [path,role,,schema] of defs){
  if(role!=='admin')continue;
  const obj=api.components.schemas[schema];
  assert.equal(obj.properties.items.maxItems,50);
  assert.ok(!Object.hasOwn(obj,'maxProperties'));
  assert.match(api.paths[path].get.description,/UNBOUNDED total records/);
 }
});
