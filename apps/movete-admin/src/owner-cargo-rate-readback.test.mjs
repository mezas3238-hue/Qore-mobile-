import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyOwnerCargoRateReadback as check}
 from './owner-cargo-rate-readback.mjs';
const rate=(n=1,kind='MOTO')=>({
 vehicleKind:kind,cargoZone:'ASUNCION',
 ruleId:'12400000-0000-4124-8124-000000000001',
 ruleVersion:'MOTO_ASUNCION_V'+n,version:n,
 basePyg:2100,perKmPyg:800,perMinutePyg:100,minimumPyg:4000,
 commissionBps:800,active:true,validUntil:'2026-12-01T15:00:00Z',
 mode:'STAGING_DEMO_ONLY',liveEnabled:false,
 passengerSubsidyPolicyApplicable:false
});
const run=(written=rate(),readback=rate(),other={})=>check({
 written,readback,previousVersion:0,kind:'MOTO',zone:'ASUNCION',...other
});
test('D allows initial G124 POST v1 only when subsequent GET matches entire rule',()=>{
 assert.equal(run().ok,true);
});
test('D reconciles new G124 version, not stale older version',()=>{
 assert.equal(run(rate(2),rate(2),{previousVersion:1}).ok,true);
 assert.equal(run(rate(2),rate(1),{previousVersion:1}).ok,false);
 assert.equal(run(rate(1),rate(1),{previousVersion:1}).ok,false);
});
test('D rejects same rule ID/version with changed amounts or commission',()=>{
 for(const prop of ['basePyg','perKmPyg','perMinutePyg','minimumPyg',
  'commissionBps','validUntil','ruleVersion']){
  const b={...rate(),[prop]:typeof rate()[prop]==='number'
   ?rate()[prop]+1:rate()[prop]+'X'};
  assert.equal(run(rate(),b).code,'CARGO_WRITE_READBACK_MISMATCH');
 }
});
test('D rejects swapped vehicle, zone, wrong mode and passenger subsidy',()=>{
 for(const o of [
  {...rate(),vehicleKind:'AUTO'}, {...rate(),cargoZone:'CENTRAL'},
  {...rate(),mode:'PRODUCTION'}, {...rate(),liveEnabled:true},
  {...rate(),passengerSubsidyPolicyApplicable:true},
  {...rate(),active:false}]){
  assert.equal(run(rate(),o).ok,false);
 }
});
test('D rejects absent POST/readback, forged version and invalid target',()=>{
 assert.equal(run(null).ok,false);
 assert.equal(run(rate(),null).ok,false);
 assert.equal(run(rate(),{...rate(),version:1.1}).ok,false);
 assert.equal(run(rate(),rate(),{zone:'foo'}).ok,false);
});
