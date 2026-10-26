import test from 'node:test';
import assert from 'node:assert/strict';
import {createG106PrivateDriverCurrentTripQa as create} from './g106-driver-current-trip-qa.mjs';
import {createG106DriverCurrentTripRepository as repo} from './g106-driver-current-trip-repository.mjs';
const id=n=>'10600000-0000-4106-8106-'+String(n).padStart(12,'0');
const driver=id(1),foreign=id(2),trip=id(3),session=id(4);
const at=Date.parse('2026-10-26T15:00:00Z');
const token='g106-test-verified-driver-token-000000000000';
const path='/v1/staging/driver/trips/current';
const headers={authorization:'Bearer '+token};
function fixture(row=null,role='driver',revoked=false){
 let count=0;
 const gateway=create({environment:'isolated_staging',localQaOnly:true,
  liveEnabled:false,now:()=>at,
  verifyAccessToken:async t=>{if(t!==token)throw Error('Invalid');
   return {id:driver,sessionId:session,tokenIatMs:at-5000,
    expiresAtMs:at+60000,is_anonymous:false};},
  verifySessionNotRevoked:async()=>!revoked,
  resolveExclusiveRole:async()=>role,allowRequest:()=>true,
  loadCurrentAssignedTrip:async()=>{count++;return row;}
 });
 return {gateway,count:()=>count};
}
test('G106 active Driver can rediscover own persisted trip; none is noncommercial',async()=>{
 const f=fixture({tripId:trip,driverId:driver,status:'arriving',revision:3});
 const answer=await f.gateway({method:'GET',path,headers});
 assert.equal(answer.status,200);
 assert.deepEqual(answer.body.activeTrip,{tripId:trip,status:'arriving',revision:3});
 assert.equal(answer.body.productionEnabled,false);
 assert(!JSON.stringify(answer).includes(driver));
 assert(!JSON.stringify(answer).includes(token));
 assert.equal((await fixture().gateway({method:'GET',path,headers})).body.activeTrip,null);
});
test('G106 requires signed-in exclusive Driver; rejects forged origin or body',async()=>{
 for(const f of [fixture(null,'passenger'),fixture(null,null),fixture(null,'driver',true)]){
  assert.notEqual((await f.gateway({method:'GET',path,headers})).status,200);
  assert.equal(f.count(),0);
 }
 for(const query of [
  {method:'POST',path,headers},
  {method:'GET',path:path+'?driverId='+driver,headers},
  {method:'GET',path,headers,body:{driverId:driver}},
  {method:'GET',path,headers:{...headers,cookie:'x'}},
  {method:'GET',path,headers:{authorization:'Bearer invalid'}}
 ]){
  const f=fixture();
  assert.notEqual((await f.gateway(query)).status,200);
  assert.equal(f.count(),0);
 }
});
test('G106 denies unrelated, terminal and PII-extended SQL projections',async()=>{
 for(const row of [
  {tripId:trip,driverId:foreign,status:'accepted',revision:2},
  {tripId:trip,driverId:driver,status:'completed',revision:7},
  {tripId:trip,driverId:driver,status:'searching',revision:1},
  {tripId:trip,driverId:driver,status:'arriving',revision:3,passengerId:foreign}
 ]){
  assert.equal((await fixture(row).gateway({method:'GET',path,headers})).status,503);
 }
 assert.throws(()=>create());
});
test('G106 SQL repository selects only active records of verified Driver',async()=>{
 const trace=[];
 const db={from:t=>{trace.push(['from',t]);return{
  select:c=>{trace.push(['select',c]);return db._q;}}}};
 db._q={eq(k,v){trace.push(['eq',k,v]);return this;},
  in(k,v){trace.push(['in',k,v]);return this;},
  async limit(n){trace.push(['limit',n]);return {data:[
   {id:trip,driver_id:driver,status:'accepted',revision:2}],error:null};}
 };
 const r=repo({db});
 assert.deepEqual(await r.loadCurrentAssignedTrip({actorId:driver}),
  {tripId:trip,driverId:driver,status:'accepted',revision:2});
 assert.deepEqual(trace,[
  ['from','mobility_stage_auto_demo_trips'],
  ['select','id,driver_id,status,revision'],
  ['eq','driver_id',driver],
  ['in','status',['accepted','arriving','in_progress']],['limit',2]
 ]);
 await assert.rejects(()=>r.loadCurrentAssignedTrip({actorId:'bad'}));
 const bad=repo({db:{from:()=>({select(){return this;},eq(){return this;},
 in(){return this;},limit:async()=>({data:[
 {id:trip,driver_id:foreign,status:'accepted',revision:2}],error:null})})}});
 await assert.rejects(()=>bad.loadCurrentAssignedTrip({actorId:driver}));
});
