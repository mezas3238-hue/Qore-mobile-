import test from 'node:test';
import assert from 'node:assert/strict';
import {NATIONAL_ZONES_LIVE_ENABLED,evaluateSyntheticZone} from './staging-zone-policy.mjs';
const zone={id:'asuncion_demo',country:'PY',mode:'SYNTHETIC_STAGING',liveEnabled:false,status:'test_enabled',allowedServices:['AUTO','MOTO','DELIVERY'],motoPassengerLegalityVerified:false,polygon:[]};
const args={zone,service:'AUTO',point:{lat:-25.3,lng:-57.6},insidePolygon:()=>true};
test('staging zone never authorizes real dispatch',()=>{const r=evaluateSyntheticZone(args);assert.equal(NATIONAL_ZONES_LIVE_ENABLED,false);assert.equal(r.ok,true);assert.equal(r.dispatchAuthorized,false);assert.equal(r.liveEnabled,false);});
test('national coverage does not imply availability',()=>{for(const patch of [{status:'planned'},{country:'AR'},{liveEnabled:true},{allowedServices:[]},{mode:'LIVE'}])assert.equal(evaluateSyntheticZone({...args,zone:{...zone,...patch}}).ok,false);});
test('motorcycle legality must be verified separately',()=>{assert.equal(evaluateSyntheticZone({...args,service:'MOTO'}).ok,false);assert.equal(evaluateSyntheticZone({...args,service:'MOTO',zone:{...zone,motoPassengerLegalityVerified:true}}).ok,true);});
test('geofence and invalid location fail closed',()=>{assert.equal(evaluateSyntheticZone({...args,insidePolygon:()=>false}).ok,false);assert.equal(evaluateSyntheticZone({...args,insidePolygon:()=>{throw Error('offline');}}).ok,false);assert.equal(evaluateSyntheticZone({...args,point:{lat:NaN,lng:0}}).ok,false);});
