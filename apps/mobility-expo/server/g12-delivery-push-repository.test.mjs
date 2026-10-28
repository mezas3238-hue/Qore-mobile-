import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryPushRepository,DELIVERY_PUSH_REPOSITORY_LIVE_ENABLED} from './g12-delivery-push-repository.mjs';
const worker='00000000-0000-4000-8000-000000000001',offer='00000000-0000-4000-8000-000000000002',courier='00000000-0000-4000-8000-000000000003',delivery='00000000-0000-4000-8000-000000000004';
const row={offer_id:offer,courier_id:courier,delivery_id:delivery,expires_at:'2099-01-01T00:00:00Z'};
test('G12 private repository never enables live mode',()=>assert.equal(DELIVERY_PUSH_REPOSITORY_LIVE_ENABLED,false));
test('G12 private repository claims one durable offer with normalized identity',async()=>{
 let called;
 const repo=createDeliveryPushRepository({rpc:async(name,args)=>(called={name,args},{data:[row],error:null})});
 const result=await repo.claim({workerId:worker});
 assert.equal(called.name,'mobility_stage_claim_delivery_push');
 assert.deepEqual(called.args,{_worker_id:worker});
 assert.equal(result.offerId,offer);assert.equal(result.courierId,courier);
 assert.equal(result.deliveryId,delivery);assert.equal(result.liveEnabled,false);
});
test('G12 empty queue and valid provider ticket ACK',async()=>{
 const calls=[];
 const repo=createDeliveryPushRepository({rpc:async(name,args)=>{
  calls.push([name,args]);return {data:name.includes('claim')?[]:true,error:null};
 }});
 assert.equal(await repo.claim({workerId:worker}),null);
 assert.equal(await repo.ack({workerId:worker,offerId:offer,ticketId:'ticket_12345'}),true);
 assert.equal(calls[1][0],'mobility_stage_ack_delivery_push');
});
test('G12 rejects forged and ambiguous claims',async()=>{
 for(const data of [[row,row],[{...row,courier_id:'invalid'}],[{...row,expires_at:'not-a-date'}],null]){
  const repo=createDeliveryPushRepository({rpc:async()=>({data,error:null})});
  await assert.rejects(()=>repo.claim({workerId:worker}));
 }
});
test('G12 refuses invalid RPC responses and untrusted ACK inputs',async()=>{
 const repo=createDeliveryPushRepository({rpc:async()=>({data:'true',error:null})});
 await assert.rejects(()=>repo.ack({workerId:worker,offerId:offer,ticketId:'ticket_12345'}));
 await assert.rejects(()=>repo.ack({workerId:worker,offerId:offer,ticketId:'bad'}));
 await assert.rejects(()=>repo.claim({workerId:'bad'}));
 assert.throws(()=>createDeliveryPushRepository({}),/Trusted PostgreSQL/);
});
