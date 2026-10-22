import test from 'node:test';
import assert from 'node:assert/strict';
import {GPS_LIVE_ENABLED,verifyGpsSample,externalNavigationLinks,createStagingRoutesAdapter} from './gps-staging-contract.mjs';
const now=2_000_000;
const good={lat:-25.28,lng:-57.63,accuracyMeters:15,capturedAtMs:now-1000,consentGranted:true,available:true};
test('staging GPS requires explicit consent and recent accurate coordinates',()=>{
 assert.equal(GPS_LIVE_ENABLED,false);
 assert.equal(verifyGpsSample(good,now).ok,true);
 for(const patch of [{consentGranted:false},{available:false},{capturedAtMs:now-30001},{accuracyMeters:76},{lat:91},{lng:Infinity},{capturedAtMs:NaN}]){
  const result=verifyGpsSample({...good,...patch},now);
  assert.equal(result.ok,false);
  assert.equal(JSON.stringify(result).includes('-25.28'),false);
 }
});
test('navigation only returns safe external links for valid destination',()=>{
 const links=externalNavigationLinks({lat:-25.28,lng:-57.63});
 assert.match(links.googleMaps,/google.com\/maps\/dir/);
 assert.match(links.waze,/waze.com\/ul/);
 assert.equal(externalNavigationLinks({lat:200,lng:0}),null);
 assert.equal(externalNavigationLinks({lat:NaN,lng:0}),null);
});
test('staging routing adapter rejects live or oversized requests without calling provider',async()=>{
 let calls=0;
 const adapter=createStagingRoutesAdapter(async()=>{calls++;return [];});
 for(const req of [{mode:'LIVE',origins:[{}],destination:{lat:0,lng:0}},{mode:'SYNTHETIC_STAGING',origins:Array(21).fill({}),destination:{lat:0,lng:0}}]){
  assert.equal((await adapter(req)).ok,false);
 }
 assert.equal(calls,0);
 assert.equal((await adapter({mode:'SYNTHETIC_STAGING',origins:[{}],destination:{lat:0,lng:0}})).ok,true);
 assert.equal(calls,1);
});
