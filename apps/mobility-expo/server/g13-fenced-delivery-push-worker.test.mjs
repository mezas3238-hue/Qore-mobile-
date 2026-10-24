import test from 'node:test';
import assert from 'node:assert/strict';
import {createFencedDeliveryPushWorker,G13_PUSH_LIVE_ENABLED}
 from './g13-fenced-delivery-push-worker.mjs';
import {createFencedDeliveryPushRepository}
 from './g13-fenced-delivery-push-repository.mjs';

const workerA='00000000-0000-4000-8000-000000000001';
const workerB='00000000-0000-4000-8000-000000000002';
const offerId='00000000-0000-4000-8000-000000000003';
const courierId='00000000-0000-4000-8000-000000000004';
const deliveryId='00000000-0000-4000-8000-000000000005';
const nonceA='00000000-0000-4000-8000-000000000006';
const nonceB='00000000-0000-4000-8000-000000000007';
const claim=(claimNonce=nonceA)=>({
 offerId,courierId,deliveryId,claimNonce,
 expiresAtMs:Date.now()+30000,liveEnabled:false
});

test('G13 never enables LIVE and requires trusted dependencies',()=>{
 assert.equal(G13_PUSH_LIVE_ENABLED,false);
 assert.throws(()=>createFencedDeliveryPushWorker({}),/Trusted G13/);
});
test('G13 provider sees only one send after authorization and ACK cannot assert receipt',async()=>{
 let begins=0,sends=0,acks=0;
 const w=createFencedDeliveryPushWorker({workerId:workerA,
  claim:async()=>claim(),
  begin:async x=>{assert.equal(x.claimNonce,nonceA);begins++;return true;},
  sendToProvider:async x=>{
   assert.equal(begins,1);assert.equal(x.idempotencyKey,'delivery-offer-'+offerId);
   sends++;return {accepted:true,ticketId:'ticket_12345'};
  },
  ack:async x=>{assert.equal(x.claimNonce,nonceA);acks++;return true;}
 });
 const out=await w.processOne();
 assert.deepEqual({ok:out.ok,providerAccepted:out.providerAccepted,deviceReceived:out.deviceReceived},
  {ok:true,providerAccepted:true,deviceReceived:false});
 assert.deepEqual([begins,sends,acks],[1,1,1]);
});
test('G13 refuses expired, forged, or missing fenced claim without provider contact',async()=>{
 for(const data of [null,{...claim(),claimNonce:'spoof'},
  {...claim(),expiresAtMs:Date.now()-1},{...claim(),liveEnabled:true}]){
  let sends=0,begins=0;
  const w=createFencedDeliveryPushWorker({workerId:workerA,
   claim:async()=>data,begin:async()=>{begins++;return true;},
   sendToProvider:async()=>{sends++;return {accepted:true,ticketId:'ticket_12345'};},
   ack:async()=>true});
  const out=await w.processOne();
  assert.equal(out.ok,data===null);assert.equal(sends,0);
  assert.equal(begins,0);
 }
});
test('G13 claim lease fencing blocks stale worker before provider side effect',async()=>{
 let liveNonce=nonceB,sends=0;
 const begin=async x=>x.claimNonce===liveNonce;
 const sendToProvider=async()=>{sends++;return {accepted:true,ticketId:'ticket_12345'};};
 const stale=createFencedDeliveryPushWorker({workerId:workerA,
  claim:async()=>claim(nonceA),begin,ack:async()=>true,sendToProvider});
 const fresh=createFencedDeliveryPushWorker({workerId:workerB,
  claim:async()=>claim(nonceB),begin,ack:async()=>true,sendToProvider});
 const a=await stale.processOne(),b=await fresh.processOne();
 assert.equal(a.ok,false);assert.equal(b.ok,true);
 assert.equal(sends,1);
});
test('G13 timeout or uncertain provider response does not imply retry or device receipt',async()=>{
 let sends=0,acks=0,beginCalls=0;
 const w=createFencedDeliveryPushWorker({workerId:workerA,
  claim:async()=>claim(),
  begin:async()=>{beginCalls++;return true;},
  sendToProvider:async()=>{sends++;throw Error('provider timeout after side effect');},
  ack:async()=>{acks++;return true;}});
 assert.equal((await w.processOne()).ok,false);
 assert.equal(beginCalls,1);assert.equal(sends,1);assert.equal(acks,0);
});
test('G13 worker does not send if offer expires after BEGIN',async()=>{
 let tick=0,sends=0;
 const w=createFencedDeliveryPushWorker({workerId:workerA,now:()=>tick,
  claim:async()=>({...claim(),expiresAtMs:6000}),
  begin:async()=>{tick=5000;return true;},
  sendToProvider:async()=>{sends++;return {accepted:true,ticketId:'ticket_12345'};},
  ack:async()=>true});
 assert.equal((await w.processOne()).ok,false);assert.equal(sends,0);
});
test('G13 two workers using v2 repository do not send twice',async()=>{
 let issued=false,nonce=nonceA,attempts=0;
 const rpc=async(name,args)=>{
  if(name==='mobility_stage_claim_delivery_push_v2'){
   if(issued)return {data:[],error:null};
   issued=true;return {data:[{offer_id:offerId,courier_id:courierId,
    delivery_id:deliveryId,claim_nonce:nonce,expires_at:'2099-01-01T00:00:00Z'}],error:null};
  }
  if(name==='mobility_stage_begin_delivery_push_v2')
   return {data:args._claim_nonce===nonce,error:null};
  if(name==='mobility_stage_ack_delivery_push_v2')
   return {data:args._claim_nonce===nonce,error:null};
  throw Error('Unexpected G13 RPC');
 };
 const repository=createFencedDeliveryPushRepository({rpc});
 const sendToProvider=async()=>{attempts++;return {accepted:true,ticketId:'ticket_12345'};};
 const one=createFencedDeliveryPushWorker({workerId:workerA,
  ...repository,sendToProvider});
 const two=createFencedDeliveryPushWorker({workerId:workerB,
  ...repository,sendToProvider});
 // Spread of Object.freeze methods is intentional: bound closure preserves RPC.
 const result=await Promise.all([one.processOne(),two.processOne()]);
 assert.equal(result.filter(x=>x.providerAccepted).length,1);
 assert.equal(attempts,1);
});
