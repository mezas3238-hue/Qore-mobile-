import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';

const ref='staging1234567890abcd';
const anonKey='sb_publishable_abcdefghijklmnopqrstuvwxyz';
const serviceKey='sb_secret_abcdefghijklmnopqrstuvwxyz';
const passenger='11111111-1111-4111-8111-111111111111';
const driver='22222222-2222-4222-8222-222222222222';
const stranger='33333333-3333-4333-8333-333333333333';
const ride='44444444-4444-4444-8444-444444444444';
const offer='55555555-5555-4555-8555-555555555555';
const vehicle='66666666-6666-4666-8666-666666666666';
const requestKey='77777777-7777-4777-8777-777777777777';
const deliveryId='88888888-8888-4888-8888-888888888888';
const deliveryProof='99999999-9999-4999-8999-999999999999';
const now=100_000;
const jwt={rider:'syntheticRiderBearerTokenNoRealJwt12345',
 driver:'syntheticDriverBearerTokenNoRealJwt12345',
 stranger:'syntheticStrangerBearerTokenNoRealJwt12345'};
function mockSupabase(){
 const state={policy:true,missing:null,rolesLookups:0,dualRoleDriver:false,authCalls:0,rpcs:[],clients:[],
  trip:{id:ride,passenger_id:passenger,driver_id:null,vehicle_id:null,
   status:'searching',revision:1,service:'economico',
   origin_tag:'PANTEON',destination_tag:'SHOPPING'},
  offer:{id:offer,trip_id:ride,driver_id:driver,status:'offered',
   expires_at:new Date(now+20_000).toISOString()},
  delivery:null};
 const request=async(url,opt)=>{
  assert.equal(url,'https://'+ref+'.supabase.co/auth/v1/settings');
  assert.equal(opt.method,'GET');
  assert.equal(opt.headers.apikey,anonKey);
  return {ok:true,json:async()=>({disable_signup:state.policy})};
 };
 const createClient=(url,key)=>{
  assert.equal(url,'https://'+ref+'.supabase.co');
  state.clients.push(key);
  if(key===anonKey)return {auth:{getUser:async(token)=>{
   state.authCalls++;
   const id=token===jwt.rider?passenger:token===jwt.driver?driver:token===jwt.stranger?stranger:null;
   return id?{data:{user:{id,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'}}}:
    {error:{message:'Unauthorized'}};
  }}};
  if(key!==serviceKey)throw Error('Wrong server key');
  return {
   from(table){
    let filter={};
    return {
     select(cols,options){
      return {
       eq(k,v){filter[k]=v;return this;},
       or(expression){filter.$or=expression;return this;},
       async limit(n){
        if(table==='user_roles'){
         state.rolesLookups++;
         const roles=filter.user_id===passenger?['passenger']:
          filter.user_id===driver?(state.dualRoleDriver?['driver','admin']:['driver']):[];
         return {data:roles.map(role=>({role})),error:null};
        }
        assert.equal(options?.head,true);
        assert.equal(n,0);
        return {error:state.missing===table?{code:'42P01'}:null};
       },
       async maybeSingle(){
        if(table==='mobility_stage_auto_demo_offers'){
         const o=state.offer;
         return {data:o.id===filter.id&&o.driver_id===filter.driver_id?{...o}:null,error:null};
        }
        if(table==='mobility_stage_auto_demo_trips'){
         const t=state.trip;
         const actor=filter.$or?.match(/passenger_id\.eq\.([^,]+)/)?.[1];
         const ok=t.id===filter.id&&(!actor||
          t.passenger_id===actor||t.driver_id===actor);
         return {data:ok?{...t}:null,error:null};
        }
        if(table==='mobility_stage_deliveries'){
         const d=state.delivery;
         const actor=filter.$or?.match(/sender_id\.eq\.([^,]+)/)?.[1];
         const ok=d&&d.id===filter.id&&
          (d.sender_id===actor||d.courier_id===actor);
         return {data:ok?{...d}:null,error:null};
        }
        return {data:null,error:null};
       }
      };
     },
    };
   },
   async rpc(name,params){
    state.rpcs.push({name,params});
    if(name==='mobility_stage_auto_demo_request'){
     if(params._passenger_id!==passenger)return {error:{message:'Wrong passenger'}};
     return {data:ride,error:null};
    }
    if(name==='mobility_stage_auto_demo_accept_offer'){
     if(state.trip.status!=='searching'||params._driver_id!==driver||
        params._offer_id!==offer||state.offer.status!=='offered')
      return {error:{message:'Already decided'}};
     state.trip={...state.trip,status:'accepted',driver_id:driver,
      vehicle_id:vehicle,revision:2};
     state.offer.status='accepted';
     return {data:requestKey,error:null};
    }
    if(name==='mobility_stage_auto_demo_transition'){
     const next={arriving:'accepted',in_progress:'arriving',completed:'in_progress',cancelled:'searching'};
     if(params._trip_id!==ride||state.trip.status!==next[params._next]||
       (params._next==='cancelled'?params._actor_id!==passenger:
        params._actor_id!==driver))return {error:{message:'Transition denied'}};
     state.trip={...state.trip,status:params._next,revision:state.trip.revision+1};
     return {data:params._request_key,error:null};
    }
    if(name==='mobility_stage_delivery_request'){
     if(params._sender_id!==passenger||state.delivery)
      return {error:{message:'Delivery request denied'}};
     state.delivery={id:deliveryId,sender_id:passenger,courier_id:null,
      vehicle_id:null,requested_vehicle_kind:params._vehicle_kind,
      category:params._category,grams:params._grams,length_cm:params._length_cm,
      width_cm:params._width_cm,height_cm:params._height_cm,
      pickup_tag:params._pickup_tag,delivery_tag:params._delivery_tag,
      restricted_item_declared:false,status:'requested',revision:1,proof_ref:null};
     return {data:deliveryId,error:null};
    }
    if(name==='mobility_stage_delivery_accept'){
     if(params._courier_id!==driver||params._delivery_id!==deliveryId||
        state.delivery?.status!=='requested')return {error:{message:'Accept denied'}};
     state.delivery={...state.delivery,courier_id:driver,vehicle_id:params._vehicle_id,
      status:'accepted',revision:2};
     return {data:params._request_key,error:null};
    }
    if(name==='mobility_stage_delivery_transition'){
     const expected={pickup:'accepted',deliver:'picked_up',dispute:'delivered',
      return:'disputed',cancel:'requested'};
     const actor=params._action==='dispute'||params._action==='cancel'?passenger:driver;
     if(params._delivery_id!==deliveryId||params._actor_id!==actor||
        state.delivery?.status!==expected[params._action])
      return {error:{message:'Custody transition denied'}};
     const next={pickup:'picked_up',deliver:'delivered',dispute:'disputed',
      return:'returned',cancel:'cancelled'}[params._action];
     state.delivery={...state.delivery,status:next,revision:state.delivery.revision+1,
      proof_ref:params._action==='deliver'?params._proof_ref:state.delivery.proof_ref};
     return {data:params._request_key,error:null};
    }
    return {data:offer,error:null};
   },
  };
 };
 return {state,request,createClient};
}
const prepare=(m,options={})=>prepareQoreG4StagingRuntime({
 environment:'staging',liveTripsEnabled:false,allowQa:true,
 projectRef:ref,anonKey,serviceKey,
 request:m.request,createClient:m.createClient,now:()=>now,...options
});
async function http(runtime,callback){
 const base=await listenQoreRadarLoopback(runtime.server);
 try{return await callback(base);}
 finally{await new Promise((resolve,reject)=>runtime.server.close(e=>e?reject(e):resolve()));}
}
async function req(base,path,actor='rider',method='GET',body){
 const res=await fetch(base+path,{
  method,
  headers:{authorization:'Bearer '+jwt[actor],
   ...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 return {status:res.status,body:await res.json()};
}
const statusPath='/v1/staging/rider/trips/'+ride+'/status';
const offerPath='/v1/staging/driver/offers/'+offer;
const acceptPath='/v1/staging/driver/offers/accept';
const requestPath='/v1/staging/rider/trips/request';
const transitionPath='/v1/staging/trips/'+ride+'/transition';
const deliveryRequestPath='/v1/staging/sender/deliveries/request';
const deliveryAcceptPath='/v1/staging/courier/deliveries/'+deliveryId+'/accept';
const deliveryTransitionPath='/v1/staging/deliveries/'+deliveryId+'/transition';
const deliveryStatusPath='/v1/staging/deliveries/'+deliveryId+'/status';

test('boot refuses even loopback listener when native Auth signup remains public',async()=>{
 const m=mockSupabase();m.state.policy=false;
 await assert.rejects(prepare(m),/Auth public signup/);
 assert.equal(m.state.rpcs.length,0);
});
test('boot refuses G3/G4 missing private SQL tables (without any remote write)',async()=>{
 const m=mockSupabase();m.state.missing='mobility_stage_auto_demo_offers';
 await assert.rejects(prepare(m),/schema not installed/);
 assert.equal(m.state.rpcs.length,0);
});
test('boot rejects LIVE, old backend, unsafe env and public/foreign server role',async()=>{
 const m=mockSupabase();
 for(const options of [
  {environment:'production'},{liveTripsEnabled:true},
  {liveTripsEnabled:'false'},{allowQa:false},
  {projectRef:'qdqrlgzlotnfdxzpacxs'},
  {anonKey:serviceKey},{serviceKey:anonKey},
  {serviceKey:'sb_secret_bad'}
 ])await assert.rejects(prepare(m,options));
 assert.equal(m.state.rpcs.length,0);
});
test('real HTTP with Supabase-like adapters verifies role/JWT and uses server-derived driver ID',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 assert.equal(runtime.commercialRidesEnabled,false);
 assert.equal(runtime.server.listening,false);
 await http(runtime,async base=>{
  const searching=await req(base,statusPath);
  assert.equal(searching.status,200);
  assert.equal(searching.body.event.acceptedDriver,null);
  assert.equal((await req(base,offerPath,'stranger')).status,403);
  const open=await req(base,offerPath,'driver');
  assert.equal(open.status,200);
  assert.equal(open.body.expiresAtMs,now+20_000);
  const accepted=await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey});
  assert.equal(accepted.status,200);
  assert.equal(accepted.body.passengerEventDelivered,false);
  assert.deepEqual(m.state.rpcs,[{
   name:'mobility_stage_auto_demo_accept_offer',
   params:{_offer_id:offer,_driver_id:driver,_decision_key:requestKey}
  }]);
  // G1 profile table has no name/photo/rating: NEVER make up an identity.
  const after=await req(base,statusPath);
  assert.equal(after.status,503);
  assert.doesNotMatch(JSON.stringify(after),/TEST777|Toyota|-25\./);
  assert.equal((await req(base,statusPath,'stranger')).status,403);
 });
});
test('runtime persists passenger request and driver transition through shared repository',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const created=await req(base,requestPath,'rider','POST',{
   requestKey,originTag:'PANTEON',destinationTag:'SHOPPING',service:'economico'
  });
  assert.equal(created.status,201);
  assert.equal(created.body.tripId,ride);
  assert.equal((await req(base,requestPath,'driver','POST',{
   requestKey,originTag:'PANTEON',destinationTag:'SHOPPING',service:'economico'
  })).status,403);
  assert.equal((await req(base,acceptPath,'driver','POST',
   {offerId:offer,requestKey})).status,200);
  const eventKey='88888888-8888-4888-8888-888888888888';
  const arriving=await req(base,transitionPath,'driver','POST',
   {event:'arrive',eventKey});
  assert.equal(arriving.status,200);
  assert.equal(arriving.body.serverPersisted,true);
  assert.equal(m.state.trip.status,'arriving');
  const rpc=m.state.rpcs.at(-1);
  assert.deepEqual(rpc,{name:'mobility_stage_auto_demo_transition',params:{
   _trip_id:ride,_actor_id:driver,_next:'arriving',_request_key:eventKey
  }});
  const before=m.state.rpcs.length;
  assert.equal((await req(base,transitionPath,'rider','POST',
   {event:'pickup',eventKey})).status,403);
  assert.equal(m.state.rpcs.length,before);
 });
});
test('runtime persists AUTO delivery custody and returns only participant status',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const created=await req(base,deliveryRequestPath,'rider','POST',{
   requestKey,vehicleKind:'AUTO',category:'RESTAURANT',grams:3500,
   lengthCm:40,widthCm:30,heightCm:25,pickupTag:'RESTAURANT_A',
   deliveryTag:'CUSTOMER_A',restrictedItemDeclared:false,
  });
  assert.equal(created.status,201);
  assert.equal(created.body.deliveryId,deliveryId);
  assert.equal((await req(base,deliveryAcceptPath,'driver','POST',{
   vehicleId:vehicle,requestKey,
  })).status,200);
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'pickup',eventKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  })).status,200);
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'deliver',eventKey:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   proofRef:deliveryProof,
  })).status,200);
  const status=await req(base,deliveryStatusPath,'rider');
  assert.equal(status.status,200);
  assert.equal(status.body.delivery.status,'delivered');
  assert.equal(status.body.delivery.proofRef,deliveryProof);
  assert.equal((await req(base,deliveryStatusPath,'stranger')).status,403);
  assert.doesNotMatch(JSON.stringify(status),/sb_secret|service_role/);
 });
});
test('turning public signup ON after start stops every request BEFORE Auth/SQL',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,statusPath)).status,200);
  const prior=m.state.authCalls;
  m.state.policy=false;
  assert.equal((await req(base,statusPath)).status,503);
  assert.equal((await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey})).status,503);
  assert.equal(m.state.authCalls,prior);
  assert.equal(m.state.rpcs.length,0);
 });
});
test('private service key and internal SQL data never appear in HTTP response',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  for(const [path,actor] of [[statusPath,'rider'],[offerPath,'driver']]){
   const response=await req(base,path,actor);
   assert.equal(response.status,200);
   assert.doesNotMatch(JSON.stringify(response),/sb_secret|sb_publishable|service_role/);
  }
 });
});

test('dual-role driver with admin privileges is denied private offers and acceptance',async()=>{
 const m=mockSupabase();m.state.dualRoleDriver=true;
 const runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,offerPath,'driver')).status,403);
  assert.equal((await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey})).status,403);
  assert.equal(m.state.rpcs.length,0);
 });
});
