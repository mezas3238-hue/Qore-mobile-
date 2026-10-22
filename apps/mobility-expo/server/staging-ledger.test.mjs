import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteSyntheticFare} from './fare-engine.mjs';
import {LEDGER_LIVE_ENABLED,buildSyntheticSettlement,verifyBalancedEntries} from './staging-ledger.mjs';
const quote=quoteSyntheticFare({mode:'AUTO',distanceMeters:5500,durationSeconds:900,basePyg:5000,perKmPyg:2000,perMinutePyg:200,minPyg:8000,tollsPyg:3000,commissionBps:1500,ruleVersion:'staging-v1'});
test('synthetic fare reconciles in double-entry ledger',()=>{const r=buildSyntheticSettlement({quote,transactionId:'test_1'});assert.equal(LEDGER_LIVE_ENABLED,false);assert.equal(r.ok,true);assert.equal(verifyBalancedEntries(r.entries),true);assert.equal(r.entries[0].amountPyg,22000);assert.equal(r.entries[2].amountPyg,2850);});
test('tampered and malformed settlements fail closed',()=>{assert.equal(buildSyntheticSettlement({quote:{...quote,providerPyg:100},transactionId:'test_2'}).ok,false);assert.equal(buildSyntheticSettlement({quote,transactionId:'../../bad'}).ok,false);assert.equal(verifyBalancedEntries([{account:'synthetic_cash',side:'debit',amountPyg:100}]),false);assert.equal(verifyBalancedEntries([{account:'synthetic_cash',side:'debit',amountPyg:NaN}]),false);});
