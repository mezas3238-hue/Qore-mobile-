import test from 'node:test';
import assert from 'node:assert/strict';
import {createFencedDeliveryPushRepository,G13_DELIVERY_PUSH_LIVE_ENABLED}
 from './g13-fenced-delivery-push-repository.mjs';
const worker='00000000-0000-4000-8000-000000000001';
const offer='00000000-0000-4000-8000-000000000002';
const courier='00000000-0000-4000-8000-000000000003';
const delivery='00000000-0000-4000-8000-000000000004';
const nonce='00000000-0000-4000-8000-000000000005';
const row={offer_id:offer,courier_id:courier,delivery_id:delivery,
 claim_nonce:nonce,expires_at:'2099-01-01T00:00:00Z'};
test('G13 adapter stays STAGING and parses fenced claim, begin and ACK',async()=>{
 assert.equal(G13_DELIVERY_PUSH_LIVE_ENABLED,false);
 const calls=[];
 const r=createFencedDeliveryPushRepository({rpc:async(name,args)=>{
  calls.push([name,args]);return {data:name.endsWith('claim_delivery_push_v2')?[row]:true,error:null};
 }});
 assert.deepEqual(await r.claim({workerId:worker}),{
  offerId:offer,courierId:courier,deliveryId:delivery,
  claimNonce:nonce,expiresAtMs:Date.parse(row.expires_at),liveEnabled:false
 });
 assert.equal(await r.begin({workerId:worker,offerId:offer,claimNonce:nonce}),true);
 assert.equal(await r.ack({workerId:worker,offerId:offer,claimNonce:nonce,ticketId:'ticket_12345'}),true);
 assert.deepEqual(calls.map(x=>x[0]),[
  'mobility_stage_claim_delivery_push_v2',
  'mobility_stage_begin_delivery_push_v2','mobility_stage_ack_delivery_push_v2']);
 assert.deepEqual(calls[1][1],{_worker_id:worker,_offer_id:offer,_claim_nonce:nonce});
 assert.equal(calls[2][1]._ticket_id,'ticket_12345');
});
test('G13 rejects spoofed/absent claim token or ambiguous RPC result',async()=>{
 for(const data of [[{...row,claim_nonce:'INVALID'}],
  [row,row],[{...row,expires_at:'not-a-date'}],null,'not-an-array']){
  const r=createFencedDeliveryPushRepository({rpc:async()=>({data,error:null})});
  await assert.rejects(()=>r.claim({workerId:worker}));
 }
 const invalid=createFencedDeliveryPushRepository({rpc:async()=>({data:'true',error:null})});
 await assert.rejects(()=>invalid.begin({workerId:worker,offerId:offer,claimNonce:nonce}));
 await assert.rejects(()=>invalid.ack({workerId:worker,offerId:offer,claimNonce:nonce,ticketId:'ticket_12345'}));
 await assert.rejects(()=>invalid.begin({workerId:worker,offerId:offer,claimNonce:'INVALID'}));
 await assert.rejects(()=>invalid.ack({workerId:worker,offerId:offer,claimNonce:nonce,ticketId:'bad'}));
 await assert.rejects(()=>invalid.claim({workerId:'bad'}));
 assert.throws(()=>createFencedDeliveryPushRepository({}),/Trusted G13/);
});
test('G13 accepts empty queue and bounded cleanup but refuses forged counts',async()=>{
 const repo=createFencedDeliveryPushRepository({rpc:async name=>({
  data:name==='mobility_stage_claim_delivery_push_v2'?[]:4,error:null
 })});
 assert.equal(await repo.claim({workerId:worker}),null);
 assert.equal(await repo.cleanupExpired(),4);
 for(const n of [-1,101,2.1,'2']){
  const broken=createFencedDeliveryPushRepository({rpc:async()=>({data:n,error:null})});
  await assert.rejects(()=>broken.cleanupExpired());
 }
});
test('G13 propagates failed RPC responses closed',async()=>{
 const r=createFencedDeliveryPushRepository({rpc:async()=>({data:true,error:{message:'blocked'}})});
 await assert.rejects(()=>r.claim({workerId:worker}));
 await assert.rejects(()=>r.begin({workerId:worker,offerId:offer,claimNonce:nonce}));
 await assert.rejects(()=>r.cleanupExpired());
});
