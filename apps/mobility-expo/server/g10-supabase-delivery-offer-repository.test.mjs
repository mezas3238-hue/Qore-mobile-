import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStagingDeliveryOfferRepository,
 SUPABASE_DELIVERY_OFFERS_LIVE_ENABLED} from './g10-supabase-delivery-offer-repository.mjs';
const courier='11111111-1111-4111-8111-111111111111';
const delivery='22222222-2222-4222-8222-222222222222';
const vehicle='33333333-3333-4333-8333-333333333333';
const offer='44444444-4444-4444-8444-444444444444';
const key='55555555-5555-4555-8555-555555555555';
const event='66666666-6666-4666-8666-666666666666';
const base={mode:'SYNTHETIC_STAGING',liveEnabled:false};
function mock(){
 const state={calls:[],filters:{}};
 const rows={mobility_stage_delivery_offers:{id:offer,delivery_id:delivery,
  courier_id:courier,vehicle_id:vehicle,status:'offered',
  expires_at:'2026-10-22T12:00:30Z'},mobility_stage_deliveries:{id:delivery,
  requested_vehicle_kind:'MOTO',category:'PARCEL',grams:1000,length_cm:20,
  width_cm:15,height_cm:10,pickup_tag:'SHOP_A',delivery_tag:'CLIENT_A',status:'requested'}};
 const client={
  async rpc(name,params){state.calls.push({name,params});return {data:
   name.endsWith('_offer')&&!name.includes('accept')&&!name.includes('decline')?offer:
    name.includes('accept')?event:offer,error:null};},
  from(table){state.filters[table]={};const chain={
   select(columns){state.filters[table].columns=columns;return chain;},
   eq(field,value){state.filters[table][field]=value;return chain;},
   async maybeSingle(){const row=rows[table];const filters=state.filters[table];
    const allowed=Object.entries(filters).filter(([k])=>k!=='columns')
     .every(([k,v])=>row[k]===v);return {data:allowed?{...row}:null,error:null};}
  };return chain;}
 };
 return {client,state,rows};
}
test('repository is permanently no-LIVE and requires server client',()=>{
 assert.equal(SUPABASE_DELIVERY_OFFERS_LIVE_ENABLED,false);
 assert.throws(()=>createSupabaseStagingDeliveryOfferRepository({}),/server-only/i);
});
test('creates and decides offers with server identities and atomic RPCs',async()=>{
 const m=mock(),repo=createSupabaseStagingDeliveryOfferRepository(m.client);
 assert.equal((await repo.create({...base,deliveryId:delivery,courierId:courier,
  vehicleId:vehicle,requestKey:key,ttlSeconds:30})).offerId,offer);
 assert.equal((await repo.accept({...base,actorId:courier,offerId:offer,
  decisionKey:key})).eventId,event);
 assert.equal((await repo.decline({...base,actorId:courier,offerId:offer,
  decisionKey:key})).offerId,offer);
 assert.deepEqual(m.state.calls,[
  {name:'mobility_stage_delivery_offer',params:{_delivery_id:delivery,
   _courier_id:courier,_vehicle_id:vehicle,_request_key:key,_ttl_seconds:30}},
  {name:'mobility_stage_delivery_accept_offer',params:{_offer_id:offer,
   _courier_id:courier,_decision_key:key}},
  {name:'mobility_stage_delivery_decline_offer',params:{_offer_id:offer,
   _courier_id:courier,_decision_key:key}},
 ]);
});
test('snapshot scopes private offer to verified courier and requested delivery',async()=>{
 const m=mock(),repo=createSupabaseStagingDeliveryOfferRepository(m.client);
 const result=await repo.snapshot({...base,actorId:courier,offerId:offer});
 assert.equal(result.offer.courierId,courier);
 assert.equal(result.offer.vehicleKind,'MOTO');
 assert.equal(result.offer.pickupTag,'SHOP_A');
 assert.equal(m.state.filters.mobility_stage_delivery_offers.courier_id,courier);
 assert.equal(m.state.filters.mobility_stage_deliveries.status,'requested');
 await assert.rejects(repo.snapshot({...base,
  actorId:'77777777-7777-4777-8777-777777777777',offerId:offer}),/unavailable/);
});
test('rejects malformed commands and database errors without success receipts',async()=>{
 const m=mock(),repo=createSupabaseStagingDeliveryOfferRepository(m.client);
 await assert.rejects(repo.create({...base,deliveryId:delivery,courierId:courier,
  vehicleId:vehicle,requestKey:key,ttlSeconds:90}),/private/);
 m.client.rpc=async()=>({data:null,error:{message:'private'}});
 await assert.rejects(repo.accept({...base,actorId:courier,offerId:offer,
  decisionKey:key}),/rejected/);
});
