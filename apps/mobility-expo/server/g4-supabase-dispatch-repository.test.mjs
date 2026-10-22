import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createSupabaseStagingDispatchRepository,
 SUPABASE_DISPATCH_LIVE_ENABLED,
} from './g4-supabase-dispatch-repository.mjs';

const passenger='11111111-1111-4111-8111-111111111111';
const driver='22222222-2222-4222-8222-222222222222';
const stranger='33333333-3333-4333-8333-333333333333';
const trip='44444444-4444-4444-8444-444444444444';
const offer='55555555-5555-4555-8555-555555555555';
const vehicle='66666666-6666-4666-8666-666666666666';
const key='77777777-7777-4777-8777-777777777777';
const base=actorId=>({mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId});

function mockClient(){
 const state={calls:[],filter:{},snapshot:{
  id:trip,passenger_id:passenger,driver_id:driver,vehicle_id:vehicle,
  service:'economico',origin_tag:'PANTEON',destination_tag:'AEROPUERTO',
  status:'accepted',revision:2,
 }};
 const client={
  async rpc(name,params){
   state.calls.push({kind:'rpc',name,params});
   const data=name.includes('request')?trip:name.includes('offer')&&!name.includes('accept')?offer:key;
   return {data,error:null};
  },
  from(table){
   state.calls.push({kind:'from',table});
   const chain={
    select(columns){state.filter.columns=columns;return chain;},
    eq(field,value){state.filter[field]=value;return chain;},
    or(expression){state.filter.or=expression;return chain;},
    async maybeSingle(){
     const actor=state.filter.or?.match(/passenger_id\.eq\.([^,]+)/)?.[1];
     const allowed=state.filter.id===state.snapshot.id&&
      (actor===state.snapshot.passenger_id||actor===state.snapshot.driver_id);
     return {data:allowed?{...state.snapshot}:null,error:null};
    },
   };
   return chain;
  },
 };
 return {client,state};
}

test('adapter is permanently staging-only and requires a server database client',()=>{
 assert.equal(SUPABASE_DISPATCH_LIVE_ENABLED,false);
 assert.throws(()=>createSupabaseStagingDispatchRepository({}),/server-only/i);
});

test('request and private offer derive passenger/driver from authenticated actor',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDispatchRepository(m.client);
 assert.deepEqual(await repo.request({...base(passenger),requestKey:key,
  originTag:'PANTEON',destinationTag:'AEROPUERTO',service:'economico'}),
  {ok:true,liveEnabled:false,tripId:trip});
 assert.deepEqual(await repo.offer({...base(driver),tripId:trip,driverId:driver,
  vehicleId:vehicle,requestKey:key,ttlSeconds:30}),
  {ok:true,liveEnabled:false,offerId:offer});
 assert.deepEqual(m.state.calls.slice(0,2),[
  {kind:'rpc',name:'mobility_stage_auto_demo_request',params:{
   _passenger_id:passenger,_request_key:key,_origin_tag:'PANTEON',
   _destination_tag:'AEROPUERTO',_service:'economico'}},
  {kind:'rpc',name:'mobility_stage_auto_demo_offer',params:{
   _trip_id:trip,_driver_id:driver,_vehicle_id:vehicle,
   _request_key:key,_ttl_seconds:30}},
 ]);
 await assert.rejects(repo.offer({...base(driver),tripId:trip,driverId:stranger,
  vehicleId:vehicle,requestKey:key,ttlSeconds:30}),/private offer/);
});

test('acceptance and transitions call atomic SQL RPCs with server actor',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDispatchRepository(m.client);
 assert.deepEqual(await repo.accept({...base(driver),offerId:offer,decisionKey:key}),
  {ok:true,liveEnabled:false,eventId:key});
 assert.deepEqual(await repo.transition({...base(driver),tripId:trip,
  event:'pickup',eventKey:key}),{ok:true,liveEnabled:false,eventId:key});
 assert.deepEqual(m.state.calls,[
  {kind:'rpc',name:'mobility_stage_auto_demo_accept_offer',params:{
   _offer_id:offer,_driver_id:driver,_decision_key:key}},
  {kind:'rpc',name:'mobility_stage_auto_demo_transition',params:{
   _trip_id:trip,_actor_id:driver,_next:'in_progress',_request_key:key}},
 ]);
 await assert.rejects(repo.transition({...base(driver),tripId:trip,
  event:'dispute',eventKey:key}),/transition/);
});

test('snapshot authorizes in the database using persisted participants',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDispatchRepository(m.client);
 const result=await repo.snapshot({...base(passenger),tripId:trip,
  passengerId:stranger,driverId:stranger});
 assert.equal(result.ok,true);
 assert.equal(result.trip.passengerId,passenger);
 assert.equal(result.trip.driverId,driver);
 assert.equal(m.state.filter.id,trip);
 assert.equal(m.state.filter.or,
  `passenger_id.eq.${passenger},driver_id.eq.${passenger}`);
 await assert.rejects(repo.snapshot({...base(stranger),tripId:trip}),/unavailable/);
});

test('cancelled snapshot accepts either never-assigned or previously-assigned durable rows',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDispatchRepository(m.client);
 m.state.snapshot.status='cancelled';
 assert.equal((await repo.snapshot({...base(passenger),tripId:trip})).trip.status,'cancelled');
 m.state.snapshot.driver_id=null;
 m.state.snapshot.vehicle_id=null;
 assert.equal((await repo.snapshot({...base(passenger),tripId:trip})).trip.driverId,null);
});

test('RPC errors and malformed database receipts fail closed',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDispatchRepository(m.client);
 m.client.rpc=async()=>({data:null,error:{message:'denied'}});
 await assert.rejects(repo.accept({...base(driver),offerId:offer,decisionKey:key}),/rejected/);
});
