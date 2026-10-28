import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTariff, type TariffScenario, type TariffRouteScenario} from './tariff-lab.ts';
const scenario:TariffScenario={
 scenarioId:'laboratorio_a_001',service:'economico',
 baseGs:1000,minimumGs:1500,perKmGs:2000,perMinuteGs:60,
 commissionBps:1000,roundingStepGs:100
};
const route:TariffRouteScenario={distanceMeters:1500,travelSeconds:90,providerLabel:'hypothetical'};
test('deterministic integer Guaranies: price and commission always reconcile',()=>{
 const res=simulateTariff(scenario,route);
 assert.equal(res.ok,true);
 if(!res.ok)return;
 // 1000 + 3000 + 90 = 4090 -> 4100; 10% = 410, driver share = 3690
 assert.equal(res.passengerFareGs,4100);
 assert.equal(res.platformFeeGs,410);
 assert.equal(res.driverGrossBeforeCostsGs,3690);
 assert.equal(res.passengerFareGs,res.platformFeeGs+res.driverGrossBeforeCostsGs);
 assert.equal(res.status,'RESEARCH_ONLY');
 assert.equal(res.commercialRidesEnabled,false);
 assert.ok(res.excludedCosts.includes('combustible'));
});
test('minimum fare and rounding are applied deterministically',()=>{
 const res=simulateTariff({...scenario,minimumGs:5071,roundingStepGs:500},{...route,distanceMeters:1,travelSeconds:1});
 assert.equal(res.ok,true);
 if(res.ok)assert.equal(res.passengerFareGs,5500);
});
test('boundary commission at 0 and at 50 percent cannot turn into customer operations',()=>{
 for(const commissionBps of [0,5000]){
  const res=simulateTariff({...scenario,commissionBps},route);
  assert.equal(res.ok,true);
  if(res.ok){
   assert.equal(res.platformFeeGs,res.passengerFareGs*commissionBps/10000);
   assert.equal(res.commercialRidesEnabled,false);
  }
 }
});
test('MOTO always carries NO LIVE even with declared route and commercial-looking tariff',()=>{
 const res=simulateTariff({...scenario,service:'moto_pasajero'},route);
 assert.equal(res.ok,true);
 if(res.ok){
  assert.equal(res.service,'moto_pasajero');
  assert.equal(res.commercialRidesEnabled,false);
 }
});
test('rejects unsafe numbers, casts, commission and route dimensions',()=>{
 const bad=[
  [{...scenario,baseGs:NaN},route],
  [{...scenario,perKmGs:Infinity},route],
  [{...scenario,perMinuteGs:-1},route],
  [{...scenario,baseGs:1.5},route],
  [{...scenario,commissionBps:5001},route],
  [{...scenario,commissionBps:-1},route],
  [{...scenario,roundingStepGs:1},route],
  [{...scenario,roundingStepGs:0},route],
  [{...scenario,minimumGs:0},route],
  [{...scenario,service:'motocicleta'},route],
  [{...scenario,scenarioId:'../../secret'},route],
  [scenario,{...route,distanceMeters:0}],
  [scenario,{...route,distanceMeters:1.1}],
  [scenario,{...route,distanceMeters:400001}],
  [scenario,{...route,travelSeconds:43201}],
  [scenario,{...route,travelSeconds:Infinity}],
  [scenario,{...route,providerLabel:'fake_payment_gateway'}]
 ];
 for(const [policy,estimatedRoute] of bad){
  const res=simulateTariff(policy as TariffScenario,estimatedRoute as TariffRouteScenario);
  assert.equal(res.ok,false,JSON.stringify({policy,estimatedRoute}));
  assert.equal(res.commercialRidesEnabled,false);
 }
});
test('amounts above research-only ceiling fail closed, without huge-number overflow',()=>{
 const res=simulateTariff({...scenario,baseGs:10000000,perKmGs:10000000,perMinuteGs:10000000},
  {distanceMeters:400000,travelSeconds:43200,providerLabel:'hypothetical'});
 assert.equal(res.ok,false);
});
test('all simulations are pure: policy, route and result never enable LIVE or mutate input',()=>{
 const policy=Object.freeze({...scenario});
 const estimate=Object.freeze({...route});
 const a=simulateTariff(policy,estimate);
 const b=simulateTariff(policy,estimate);
 assert.deepEqual(a,b);
 assert.equal(a.commercialRidesEnabled,false);
});
