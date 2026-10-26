import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createSupabaseStagingDeliveryRepository,SUPABASE_DELIVERY_LIVE_ENABLED,
} from './g5-supabase-delivery-repository.mjs';

const sender='11111111-1111-4111-8111-111111111111';
const courier='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
const delivery='44444444-4444-4444-8444-444444444444';
const vehicle='55555555-5555-4555-8555-555555555555';
const key='66666666-6666-4666-8666-666666666666';
const proof='77777777-7777-4777-8777-777777777777';
const base=actorId=>({mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId});
const request={...base(sender),requestKey:key,vehicleKind:'MOTO',category:'DOCUMENTS',
 grams:1200,lengthCm:30,widthCm:20,heightCm:10,pickupTag:'OFFICE_NORTH',
 deliveryTag:'OFFICE_SOUTH',restrictedItemDeclared:false};

function mockClient(){
 const state={calls:[],filter:{},snapshot:{
  id:delivery,sender_id:sender,courier_id:courier,vehicle_id:vehicle,
  requested_vehicle_kind:'MOTO',category:'DOCUMENTS',grams:1200,
  length_cm:30,width_cm:20,height_cm:10,pickup_tag:'OFFICE_NORTH',
  delivery_tag:'OFFICE_SOUTH',restricted_item_declared:false,
  status:'delivered',revision:4,proof_ref:proof,
 }};
 const client={
  async rpc(name,params){state.calls.push({name,params});return {data:key,error:null};},
  from(table){
   state.calls.push({table});
   const chain={
    select(columns){state.filter.columns=columns;return chain;},
    eq(field,value){state.filter[field]=value;return chain;},
    or(value){state.filter.or=value;return chain;},
    async maybeSingle(){
     const actor=state.filter.or?.match(/sender_id\.eq\.([^,]+)/)?.[1];
     const allowed=actor===state.snapshot.sender_id||actor===state.snapshot.courier_id;
     return {data:allowed?{...state.snapshot}:null,error:null};
    },
   };
   return chain;
  },
 };
 return {client,state};
}

test('delivery repository is permanently staging-only and server-client-only',()=>{
 assert.equal(SUPABASE_DELIVERY_LIVE_ENABLED,false);
 assert.throws(()=>createSupabaseStagingDeliveryRepository({}),/server-only/i);
});

test('request and accept bind sender/courier to authenticated actor',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDeliveryRepository(m.client);
 assert.deepEqual(await repo.request(request),{ok:true,liveEnabled:false,deliveryId:key});
 assert.deepEqual(await repo.accept({...base(courier),deliveryId:delivery,
  vehicleId:vehicle,requestKey:key}),{ok:true,liveEnabled:false,eventId:key});
 assert.equal(m.state.calls[0].params._sender_id,sender);
 assert.equal(m.state.calls[1].params._courier_id,courier);
 assert.equal(m.state.calls[0].params._restricted_item_declared,false);
 await assert.rejects(repo.request({...request,restrictedItemDeclared:true}),/invalid/i);
});

test('transition requires proof only for deliver and uses server actor',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDeliveryRepository(m.client);
 await repo.transition({...base(courier),deliveryId:delivery,event:'deliver',eventKey:key,proofRef:proof});
 assert.deepEqual(m.state.calls[0],{name:'mobility_stage_delivery_transition',params:{
  _delivery_id:delivery,_actor_id:courier,_action:'deliver',_request_key:key,_proof_ref:proof,
 }});
 await assert.rejects(repo.transition({...base(courier),deliveryId:delivery,
  event:'deliver',eventKey:key}),/invalid/i);
 await assert.rejects(repo.transition({...base(sender),deliveryId:delivery,
  event:'cancel',eventKey:key,proofRef:proof}),/invalid/i);
});

test('snapshot authorizes by persisted participant and validates custody',async()=>{
 const m=mockClient(),repo=createSupabaseStagingDeliveryRepository(m.client);
 const result=await repo.snapshot({...base(sender),deliveryId:delivery});
 assert.equal(result.delivery.status,'delivered');
 assert.equal(result.delivery.proofRef,proof);
 assert.equal(m.state.filter.or,`sender_id.eq.${sender},courier_id.eq.${sender}`);
 await assert.rejects(repo.snapshot({...base(outsider),deliveryId:delivery}),/unavailable/);
 m.state.snapshot.proof_ref=null;
 await assert.rejects(repo.snapshot({...base(sender),deliveryId:delivery}),/custody/);
});


test('G121 repository never reads delivery without both owner and requestKey',async()=>{
 const conditions={},calls=[];
 const fake={
  rpc(){throw Error('READ cannot call mutation RPC')},
  from(table){
   assert.equal(table,'mobility_stage_deliveries');
   return {select(cols){assert.equal(cols,
    'id,request_key,sender_id,requested_vehicle_kind,status,revision');return this;},
    eq(k,v){conditions[k]=v;calls.push(k);return this;},
    async maybeSingle(){return {error:null,data:conditions.sender_id===sender?
     {id:delivery,sender_id:sender,request_key:key,
      requested_vehicle_kind:'MOTO',status:'requested',revision:1}:null};}};
  }
 };
 const repo=createSupabaseStagingDeliveryRepository(fake);
 assert.deepEqual(await repo.reconcile({...base(sender),requestKey:key}),{
  ok:true,liveEnabled:false,deliveryId:delivery,requestKey:key,
  vehicleKind:'MOTO',status:'requested',revision:1});
 assert.deepEqual(calls,['request_key','sender_id']);
 assert.equal(await repo.reconcile({...base(outsider),requestKey:key}),null);
});

test('G122 quote consent binds actor and request into server-only RPC',async()=>{
 const calls=[];
 const client={from(){throw Error('No raw data writes')},
  async rpc(name,data){
   calls.push({name,data});return {error:null,data:{
    consentId:proof,deliveryId:delivery,quoteId:vehicle,
    confirmationKey:key,vehicleKind:'AUTO',acceptedTotalGs:17000,
    fareVersion:'qa-auto-rule',status:'confirmed_qa',
    serverPersisted:true,liveEnabled:false
   }};
  }};
 const r=createSupabaseStagingDeliveryRepository(client);
 const result=await r.confirmQuote({...base(sender),deliveryId:delivery,
  quoteId:vehicle,confirmationKey:key,acceptedTotalGs:17000,
  acceptedFareVersion:'qa-auto-rule'});
 assert.equal(result.consentId,proof);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'mobility_stage_g122_accept_delivery_quote_qa');
 assert.equal(calls[0].data._sender,sender);
 assert.equal(calls[0].data._accepted_total_gs,17000);
 await assert.rejects(r.confirmQuote({...base(sender),deliveryId:delivery,
  quoteId:vehicle,confirmationKey:key,acceptedTotalGs:0,
  acceptedFareVersion:'qa-auto-rule'}),/Invalid/i);
});
