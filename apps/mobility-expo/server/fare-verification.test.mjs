import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteSyntheticFare,verifySyntheticQuote} from './fare-engine.mjs';
const base={mode:'AUTO',distanceMeters:4200,durationSeconds:720,basePyg:3500,perKmPyg:1600,perMinutePyg:250,minPyg:5000,tollsPyg:1000,commissionBps:1500,ruleVersion:'test'};
test('synthetic quote reconciles independently',()=>{
 const q=quoteSyntheticFare(base);
 assert.equal(q.ok,true);
 assert.equal(verifySyntheticQuote(q),true);
});
test('forged subtotal, toll and commission cannot pass quote verification',()=>{
 const q=quoteSyntheticFare(base);
 for(const change of [
  {subtotalPyg:q.subtotalPyg+100},
  {tollsPyg:q.tollsPyg+100},
  {commissionPyg:q.commissionPyg+100,providerPyg:q.providerPyg-100},
  {commissionBps:1200},
  {breakdown:{...q.breakdown,distanceChargePyg:q.breakdown.distanceChargePyg+100}},
  {mode:'UNKNOWN'}
 ])assert.equal(verifySyntheticQuote({...q,...change}),false);
});
