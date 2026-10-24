import test from 'node:test';
import assert from 'node:assert/strict';
import {createG65PrivateDriverTripStatusQa,G65_DRIVER_TRIP_STATUS_LIVE_ENABLED}
 from './g65-driver-trip-status-qa.mjs';
import {createG65DriverTripStatusRepository}
 from './g65-driver-trip-status-repository.mjs';
const id=n=>'65650000-0000-4656-8656-'+String(n).padStart(12,'0');
const driver=id(1),session=id(2),trip=id(3),vehicle=id(4),passenger=id(5);
const bearer='verified-internal-staging-driver-jwt-000000000';
const time=Date.parse('2026-10-24T17:00:00Z');
const path='/v1/staging/driver/trips/'+trip+'/status';
const tripRow={tripId:trip,driverId:driver,vehicleId:vehicle,passengerId:passenger,
 status:'accepted',revision:2,service:'economico'};
function fixture(extra={}){
 const calls={auth:[],sql:[],role:[],revocation:[]};
 const handler=createG65PrivateDriverTripStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>time,
  verifyAccessToken:async t=>{calls.auth.push(t);return {
   id:driver,sessionId:session,tokenIatMs:time-2000,
   expiresAtMs:time+60000,is_anonymous:false};},
  verifySessionNotRevoked:async p=>{calls.revocation.push(p);return true;},
  resolveExclusiveRole:async p=>{calls.role.push(p);return 'driver';},
  allowRequest:()=>true,
  loadAssignedTrip:async p=>{calls.sql.push(p);return tripRow;},
  ...extra
 });
 return {handler,calls};
}
const request=()=>({method:'GET',path,
 headers:{authorization:'Bearer '+bearer}});
test('G65 authenticated role/session and SQL assigned Driver is read-only, privacy-minimal',async()=>{
 assert.equal(G65_DRIVER_TRIP_STATUS_LIVE_ENABLED,false);
 const x=fixture(),r=await x.handler(request());
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{mode:'STAGING_DEMO_ONLY',tripId:trip,
  state:'accepted',revision:2,nextEvent:'arrive',
  assignmentPersisted:true,qaOnly:true,productionEnabled:false,
  liveTripsEnabled:false,gpsVerified:false,passengerContactVisible:false});
 assert.deepEqual(x.calls.sql,[{actorId:driver,tripId:trip}]);
 assert.deepEqual(x.calls.auth,[bearer]);
 assert(!JSON.stringify(r).includes(passenger));
 assert(!JSON.stringify(r).includes(bearer));
});
test('G65 private lifecycle progression restricts available next event',async()=>{
 for(const [status,next] of [
  ['accepted','arrive'],['arriving','pickup'],
  ['in_progress','complete'],['completed',null],['cancelled',null]
 ]){
  const {handler}=fixture({loadAssignedTrip:async()=>({
   ...tripRow,status,revision:5})});
  const r=await handler(request());
  assert.equal(r.status,200,status);
  assert.equal(r.body.nextEvent,next,status);
 }
});
test('G65 cross-account, malformed status and old role cannot reveal private assigned trip',async()=>{
 for(const altered of [
  {...tripRow,driverId:id(99)},{...tripRow,tripId:id(99)},
  {...tripRow,passengerId:driver},{...tripRow,vehicleId:'bad'},
  {...tripRow,status:'searching'},{...tripRow,revision:1},
  {...tripRow,passengerPhone:'private'},
  null
 ]){
  const f=fixture({loadAssignedTrip:async()=>altered});
  const res=await f.handler(request());
  assert.equal(res.status,404);
  assert(!JSON.stringify(res).includes(passenger));
 }
 for(const extra of [
  {resolveExclusiveRole:async()=> 'passenger'},
  {resolveExclusiveRole:async()=> ['passenger','driver']},
  {verifySessionNotRevoked:async()=>false},
  {verifyAccessToken:async()=>{throw Error('bad JWT')}},
  {loadAssignedTrip:async()=>{throw Error('SQL offline')}},
  {allowRequest:()=>false}
 ]){
  const {handler}=fixture(extra);
  assert.notEqual((await handler(request())).status,200);
 }
});
test('G65 malformed HTTP, impersonation payload or no bearer never reaches database',async()=>{
 const x=fixture();
 for(const bad of [
  {...request(),method:'POST'}, {...request(),body:{driverId:driver}},
  {...request(),path:'/v1/staging/driver/trips/'+id(88)+'/accept'},
  {...request(),headers:{authorization:'Bearer short'}},
  {...request(),headers:{authorization:'Bearer '+bearer,cookie:'x'}}
 ]){
  assert.notEqual((await x.handler(bad)).status,200);
 }
 assert.equal(x.calls.sql.length,0);
});
test('G65 concrete Supabase adapter filters trip AND Driver directly in SQL',async()=>{
 const filters=[],selected=[];
 const row={id:trip,driver_id:driver,vehicle_id:vehicle,passenger_id:passenger,
  status:'accepted',revision:2,service:'economico'};
 const client={rpc(){},
  from(name){
   assert.equal(name,'mobility_stage_auto_demo_trips');
   const q={select(cols){selected.push(cols);return q;},
    eq(name,value){filters.push([name,value]);return q;},
    async maybeSingle(){return {data:row,error:null};}
   };return q;
  }
 };
 const repo=createG65DriverTripStatusRepository(client);
 const out=await repo.loadAssignedTrip({actorId:driver,tripId:trip});
 assert.deepEqual(out,tripRow);
 assert.deepEqual(filters,[['id',trip],['driver_id',driver]]);
 assert(!selected.join(' ').includes('origin_tag'));
 assert(!selected.join(' ').includes('destination_tag'));
 assert(!selected.join(' ').includes('phone'));
 await assert.rejects(()=>repo.loadAssignedTrip({
  actorId:driver,tripId:'bad'}));
});
test('G65 reject production runtime or absent trusted authorization adapters',()=>{
 for(const change of [
  {environment:'production'},{liveEnabled:true},{localQaOnly:false},
  {verifyAccessToken:null},{resolveExclusiveRole:null},
  {verifySessionNotRevoked:null},{loadAssignedTrip:null},{allowRequest:null}
 ])assert.throws(()=>fixture(change));
});
