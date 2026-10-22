import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryPushWorker} from './g12-delivery-push-worker.mjs';
import {createDeliveryPushRepository} from './g12-delivery-push-repository.mjs';
const workerA='00000000-0000-4000-8000-000000000001';
const workerB='00000000-0000-4000-8000-000000000002';
const offer='00000000-0000-4000-8000-000000000003';
const courier='00000000-0000-4000-8000-000000000004';
const delivery='00000000-0000-4000-8000-000000000005';
test('G12 two worker instances process one private offer once with atomic repository',async()=>{
 let claimed=false,owner=null,providerCalls=0,acks=0;
 const rpc=async(name,args)=>{
  // Synchronous claim state simulates one serialized PostgreSQL SKIP LOCKED winner.
  if(name==='mobility_stage_claim_delivery_push'){
   if(claimed)return {data:[],error:null};
   claimed=true;owner=args._worker_id;
   return {data:[{offer_id:offer,courier_id:courier,delivery_id:delivery,
    expires_at:'2099-01-01T00:00:00Z'}],error:null};
  }
  if(name==='mobility_stage_ack_delivery_push'){
   if(args._worker_id!==owner)return {data:false,error:null};
   acks++;return {data:true,error:null};
  }
  throw Error('Unexpected RPC');
 };
 const repository=createDeliveryPushRepository({rpc});
 const sendToProvider=async()=>{providerCalls++;return {accepted:true,ticketId:'ticket_12345'};};
 const a=createDeliveryPushWorker({workerId:workerA,claim:repository.claim,ack:repository.ack,sendToProvider});
 const b=createDeliveryPushWorker({workerId:workerB,claim:repository.claim,ack:repository.ack,sendToProvider});
 const results=await Promise.all([a.processOne(),b.processOne()]);
 assert.equal(results.filter(x=>x.providerAccepted).length,1);
 assert.equal(results.filter(x=>x.empty).length,1);
 assert.equal(providerCalls,1);assert.equal(acks,1);
 assert.equal(results.find(x=>x.providerAccepted).deviceReceived,false);
});
test('G12 wrong worker cannot ACK another worker claim',async()=>{
 const repository=createDeliveryPushRepository({rpc:async(name,args)=>({
  data:name==='mobility_stage_ack_delivery_push'?args._worker_id===workerA:[],error:null
 })});
 assert.equal(await repository.ack({workerId:workerB,offerId:offer,ticketId:'ticket_12345'}),false);
});
