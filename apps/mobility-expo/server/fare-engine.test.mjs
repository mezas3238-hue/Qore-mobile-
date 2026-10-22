import test from 'node:test';
import assert from 'node:assert/strict';
import {FARE_LIVE_ENABLED,quoteSyntheticFare,verifySyntheticQuote} from './fare-engine.mjs';
const base={mode:'AUTO',distanceMeters:5500,durationSeconds:900,basePyg:5000,perKmPyg:2000,perMinutePyg:200,minPyg:8000,tollsPyg:3000,commissionBps:1500,ruleVersion:'staging-v1'};
test('integer PYG, versioned commission, tolls excluded',()=>{const q=quoteSyntheticFare(base);assert.equal(FARE_LIVE_ENABLED,false);assert.equal(q.ok,true);assert.equal(q.subtotalPyg,19000);assert.equal(q.totalPyg,22000);assert.equal(q.commissionPyg,2850);assert.equal(q.providerPyg,19150);assert.equal(verifySyntheticQuote(q),true);});
test('minimum fare and zero commission',()=>{const q=quoteSyntheticFare({...base,distanceMeters:0,durationSeconds:0,tollsPyg:0,commissionBps:0});assert.equal(q.subtotalPyg,8000);assert.equal(q.commissionPyg,0);});
test('invalid prices fail closed',()=>{for(const patch of [{mode:'DRONE'},{distanceMeters:-1},{durationSeconds:Infinity},{perKmPyg:NaN},{commissionBps:10001},{ruleVersion:'../unsafe'},{basePyg:1.5},{tollsPyg:-1}])assert.equal(quoteSyntheticFare({...base,...patch}).ok,false);});
test('merchant delivery excludes product basket value',()=>{const q=quoteSyntheticFare({...base,mode:'MERCHANT_DELIVERY',commissionBps:1100});assert.equal(q.commissionPyg,2090);assert.equal(q.liveEnabled,false);});
