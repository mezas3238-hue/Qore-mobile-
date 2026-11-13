import test from 'node:test';
import assert from 'node:assert/strict';
import {admitG328PinnedAutoRoute,validG328Point,validG328PinnedRouteBody}
 from './g328-pinned-auto-evidence.mjs';
const actorId='32800000-0000-4328-8328-000000000001';
const quoteRequestKey='32800000-0000-4328-8328-000000000002';
const evidenceId='32800000-0000-4328-8328-000000000003';
const time=1794500000000;
const input={quoteRequestKey,origin:'Hernandarias, Alto Paraná',
 destination:'Ciudad del Este, Alto Paraná',service:'economico',
 pickupPoint:{latitude:-25.4061,longitude:-54.6302},
 dropoffPoint:{latitude:-25.5092,longitude:-54.6115}};
const proof=(x={})=>({source:'INDEPENDENT_PIN_AUTHORITY',
 serverVerified:true,coverageVerified:true,actorId,quoteRequestKey,
 origin:input.origin,destination:input.destination,service:'economico',
 pickupPoint:input.pickupPoint,dropoffPoint:input.dropoffPoint,
 evidenceId,revision:2,verifiedAtMs:time-1000,...x});
const admit=(x={},provider=async()=>proof(),clock=()=>time)=>admitG328PinnedAutoRoute({
 input:{...input,...x},actorId,verifyIndependentPins:provider,now:clock});
test('G328 immutable server-backed exact pin evidence, no fare or Driver authority',async()=>{
 let requested;
 const r=await admit({},async scope=>{requested=scope;return proof();});
 assert.equal(r.ok,true);
 assert.equal(r.evidence.evidenceId,evidenceId);
 assert.equal(Object.isFrozen(r.evidence),true);
 assert.equal(Object.isFrozen(r.evidence.pickupPoint),true);
 assert.deepEqual(requested.pickupPoint,input.pickupPoint);
 assert.equal(Object.keys(requested).includes('amountGs'),false);
 assert.equal(Object.hasOwn(r.evidence,'commercialEnabled'),false);
});
test('G328 rejects forged pins, extra amount, identical points, invalid bounds',async()=>{
 for(const x of [
  {...input,amountGs:100},
  {...input,driverId:actorId},
  {...input,pickupPoint:{latitude:'-25.4',longitude:-54.63}},
  {...input,pickupPoint:{latitude:0,longitude:0}},
  {...input,pickupPoint:{latitude:-25.4,longitude:-54.6,approved:true}},
  {...input,dropoffPoint:input.pickupPoint},
  {...input,destination:input.origin},
  {...input,service:'MOTO_RIDE'},
  {...input,quoteRequestKey:'fake'}
 ]){
  assert.equal(validG328PinnedRouteBody(x),false);
  assert.equal((await admitG328PinnedAutoRoute({
   input:x,actorId,verifyIndependentPins:async()=>{throw Error('must not run');},
   now:()=>time})).code,'PIN_INPUT_INVALID');
 }
 assert.equal(validG328Point(input.pickupPoint),true);
});
test('G328 denies independent attestation with wrong subject, nonce, address, point or time',async()=>{
 for(const bad of [
  {source:'CLIENT_GPS'}, {serverVerified:false},{coverageVerified:false},
  {actorId:evidenceId},{quoteRequestKey:evidenceId},{origin:'Pirated origin'},
  {destination:'Wrong destination'},{service:'xl'},
  {pickupPoint:{latitude:-25.407,longitude:-54.6302}},
  {dropoffPoint:{latitude:-25.509,longitude:-54.6115}},
  {evidenceId:'not-a-uuid'},{revision:0},
  {verifiedAtMs:time+1},{verifiedAtMs:time-60001},
  {priceGs:1000}
 ]){
  const r=await admit({},async()=>proof(bad));
  assert.equal(r.ok,false,JSON.stringify(bad));
  assert.equal(r.code,'PIN_EVIDENCE_UNVERIFIED');
 }
});
test('G328 unavailable authority or slow verification refuses all route access',async()=>{
 assert.equal((await admitG328PinnedAutoRoute({
  input,actorId,now:()=>time})).ok,false);
 const out=await admit({},async()=>{throw Error('database offline');});
 assert.deepEqual(out,{ok:false,code:'PIN_AUTHORITY_UNAVAILABLE'});
 let n=0;
 assert.equal((await admit({},async()=>proof(),()=>[time,time+30001][n++])).ok,false);
});
