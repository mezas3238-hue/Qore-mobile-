import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingDispatchPersistence,PERSISTENT_DISPATCH_LIVE_ENABLED} from './dispatch-persistence-contract.mjs';
const id='00000000-0000-4000-8000-000000000001';
const args={mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId:id,tripId:id,offerId:id,decisionKey:id};
const requestArgs={mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId:id,
 requestKey:id,originTag:'PANTEON',destinationTag:'AEROPUERTO',service:'economico'};
test('persistence contract cannot enable live dispatch',()=>assert.equal(PERSISTENT_DISPATCH_LIVE_ENABLED,false));
test('reject missing repository implementation',()=>assert.throws(()=>createStagingDispatchPersistence({}),/Incomplete/));
test('reject untrusted request before touching backend',async()=>{
 let calls=0;const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async()=>{calls++;return {ok:true,liveEnabled:false};}]));
 const d=createStagingDispatchPersistence(repo);
 assert.equal((await d.accept({...args,mode:'LIVE'})).ok,false);
 assert.equal((await d.accept({...args,actorId:'guest'})).ok,false);
 assert.equal((await d.accept({...args,decisionKey:'bad'})).ok,false);
 assert.equal(calls,0);
 assert.equal((await d.accept(args)).ok,true);
 assert.equal(calls,1);
});
test('backend errors and live-enabled responses fail closed',async()=>{
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async()=>({ok:true,liveEnabled:true})]));
 const d=createStagingDispatchPersistence(repo);assert.equal((await d.request(requestArgs)).ok,false);
 repo.request=async()=>{throw Error('offline');};assert.equal((await d.request(requestArgs)).ok,false);
});

test('passenger ownership and transition events are validated before repository',async()=>{
 let calls=0;
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async()=>{calls++;return {ok:true,liveEnabled:false};}]));
 const api=createStagingDispatchPersistence(repo);
 assert.equal((await api.request({...args,passengerId:'00000000-0000-4000-8000-000000000002'})).ok,false);
 assert.equal((await api.transition({...args,event:'unknown',eventKey:id})).ok,false);
 assert.equal((await api.transition({...args,event:'arrive',eventKey:'invalid'})).ok,false);
 assert.equal(calls,0);
 assert.equal((await api.transition({...args,event:'arrive',eventKey:id})).ok,true);
 assert.equal(calls,1);
});

test('dispatch persistence rejects array, null and scalar input without backend calls',async()=>{
 let calls=0;
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async()=>{calls++;return {ok:true,liveEnabled:false};}]));
 const api=createStagingDispatchPersistence(repo);
 for(const invalid of [null,undefined,[],42,'SYNTHETIC_STAGING']){
  const response=await api.request(invalid);
  assert.equal(response.ok,false);
  assert.equal(response.liveEnabled,false);
 }
 assert.equal(calls,0);
});

test('snapshot delegates participant authorization to persisted database identity',async()=>{
 let calls=0,actual;
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async params=>{calls++;actual=params;return {ok:true,liveEnabled:false};}]));
 const api=createStagingDispatchPersistence(repo);
 assert.equal((await api.snapshot({...args,passengerId:'00000000-0000-4000-8000-000000000002',driverId:'00000000-0000-4000-8000-000000000003'})).ok,true);
 assert.equal(calls,1);
 assert.equal(Object.hasOwn(actual,'passengerId'),false);
 assert.equal(Object.hasOwn(actual,'driverId'),false);
 assert.equal(actual.actorId,id);
});

test('request has method-specific shape and does not require a pre-existing trip id',async()=>{
 let actual;
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async params=>{actual=params;return {ok:true,liveEnabled:false};}]));
 const api=createStagingDispatchPersistence(repo);
 assert.equal((await api.request(requestArgs)).ok,true);
 assert.equal(actual.tripId,undefined);
 assert.equal((await api.request({...requestArgs,destinationTag:'bad tag'})).ok,false);
 assert.equal((await api.request({...requestArgs,originTag:'PANTEON'})).ok,true);
});
