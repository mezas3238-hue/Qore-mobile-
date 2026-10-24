import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
const resolve=ref=>{
 assert.match(ref,/^#\/(?:components|paths)\//,'only local references are allowed');
 const value=ref.slice(2).split('/').reduce((node,part)=>node?.[part.replace(/~1/g,'/').replace(/~0/g,'~')],spec);
 assert.notEqual(value,undefined,`unresolved reference: ${ref}`);
 return value;
};
test('G12: every OpenAPI local reference resolves without external schema fetches',()=>{
 const walk=(value,seen=new WeakSet())=>{
  if(!value||typeof value!=='object'||seen.has(value))return;
  seen.add(value);
  if(typeof value.$ref==='string')resolve(value.$ref);
  for(const child of Object.values(value))walk(child,seen);
 };
 walk(spec);
});
test('G12: every path variable is declared as a required path parameter',()=>{
 for(const [path,methods] of Object.entries(spec.paths)){
  const vars=[...path.matchAll(/\{([^}]+)\}/g)].map(match=>match[1]);
  for(const operation of Object.values(methods)){
   const parameters=[...(methods.parameters??[]),...(operation.parameters??[])].map(p=>p.$ref?resolve(p.$ref):p);
   for(const variable of vars){
    const matches=parameters.filter(p=>p.in==='path'&&p.name===variable&&p.required===true);
    assert.equal(matches.length,1,`${operation.operationId}: path parameter ${variable} must be declared exactly once`);
   }
   for(const p of parameters.filter(p=>p.in==='path'))
    assert.ok(vars.includes(p.name),`${operation.operationId}: unexpected path parameter ${p.name}`);
  }
 }
});
test('G12: request schemas do not declare nonexistent required properties',()=>{
 for(const [name,body] of Object.entries(spec.components.requestBodies)){
  const schema=resolve(body.content['application/json'].schema.$ref);
  for(const variant of schema.oneOf??[schema]){
   for(const key of variant.required??[])
    assert.ok(Object.hasOwn(variant.properties??{},key),`${name}: missing required property ${key}`);
   assert.equal(variant.additionalProperties,false,`${name}: request must be sealed`);
  }
 }
});
test('G12: operations require bearer security and explicit error responses',()=>{
 for(const [path,methods] of Object.entries(spec.paths))
  for(const [method,op] of Object.entries(methods)){
   if(method==='parameters')continue;
   assert.ok(op.operationId,`${method} ${path}`);
   assert.ok(op.responses?.default,`${op.operationId}: missing error response`);
   assert.notDeepEqual(op.security,[],`${op.operationId}: anonymous access forbidden`);
  }
});
