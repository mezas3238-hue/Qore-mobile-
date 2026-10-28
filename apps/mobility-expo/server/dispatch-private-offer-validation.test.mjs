import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingDispatchPersistence} from './dispatch-persistence-contract.mjs';
const id='00000000-0000-4000-8000-000000000001';
const base={mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId:id,tripId:id,driverId:id,vehicleId:id,requestKey:id,ttlSeconds:15};
test('private offers reject malformed TTL and identifiers before repository',async()=>{
 let calls=0;
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async()=>{calls++;return {ok:true,liveEnabled:false};}]));
 const api=createStagingDispatchPersistence(repo);
 for(const bad of [{ttlSeconds:4},{ttlSeconds:31},{ttlSeconds:15.5},{driverId:'bad'},{vehicleId:'bad'},{requestKey:'bad'}]){
  assert.equal((await api.offer({...base,...bad})).ok,false);
 }
 assert.equal(calls,0);
 assert.equal((await api.offer(base)).ok,true);
 assert.equal(calls,1);
});
