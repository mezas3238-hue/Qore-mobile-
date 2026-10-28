import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryPushWorker,DELIVERY_PUSH_LIVE_ENABLED} from './g12-delivery-push-worker.mjs';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
const claimData=()=>({offerId:a,courierId:b,deliveryId:c,expiresAtMs:Date.now()+60000,liveEnabled:false});
test('G12 never enables live delivery push',()=>assert.equal(DELIVERY_PUSH_LIVE_ENABLED,false));
test('G12 requires trusted worker identity and repository functions',()=>{
 assert.throws(()=>createDeliveryPushWorker({}),/Trusted STAGING/);
});
test('G12 persists provider ticket without claiming device receipt',async()=>{
 let ackArgs,sendArgs;
 const worker=createDeliveryPushWorker({workerId:a,claim:async()=>claimData(),
  sendToProvider:async x=>(sendArgs=x,{accepted:true,ticketId:'ticket_12345'}),
  ack:async x=>(ackArgs=x,true)});
 const result=await worker.processOne();
 assert.equal(result.ok,true);assert.equal(result.providerAccepted,true);
 assert.equal(result.deviceReceived,false);assert.equal(result.liveEnabled,false);
 assert.equal(ackArgs.workerId,a);assert.equal(ackArgs.offerId,a);
 assert.equal(ackArgs.ticketId,'ticket_12345');assert.equal(sendArgs.courierId,b);
 assert.equal(sendArgs.idempotencyKey,`delivery-offer-${a}`);
});
test('G12 empty queue does not invoke push provider or ACK',async()=>{
 let calls=0;
 const worker=createDeliveryPushWorker({workerId:a,claim:async()=>null,
  sendToProvider:async()=>{calls++},ack:async()=>{calls++}});
 assert.equal((await worker.processOne()).empty,true);assert.equal(calls,0);
});
test('G12 rejects expired and invalid claims before sending',async()=>{
 for(const data of [{...claimData(),expiresAtMs:Date.now()-1000},
  {...claimData(),liveEnabled:true},{...claimData(),courierId:'spoof'}]){
  let calls=0;
  const worker=createDeliveryPushWorker({workerId:a,claim:async()=>data,
   sendToProvider:async()=>{calls++},ack:async()=>{calls++}});
  assert.equal((await worker.processOne()).ok,false);assert.equal(calls,0);
 }
});
test('G12 provider failure and ACK failure fail closed',async()=>{
 for(const send of [async()=>({accepted:false,ticketId:'ticket_12345'}),
  async()=>({accepted:true,ticketId:'bad'}),async()=>{throw Error('offline')} ]){
  let ackCount=0;
  const worker=createDeliveryPushWorker({workerId:a,claim:async()=>claimData(),
   sendToProvider:send,ack:async()=>{ackCount++;return true}});
  assert.equal((await worker.processOne()).ok,false);assert.equal(ackCount,0);
 }
 const worker=createDeliveryPushWorker({workerId:a,claim:async()=>claimData(),
  sendToProvider:async()=>({accepted:true,ticketId:'ticket_12345'}),ack:async()=>false});
 assert.equal((await worker.processOne()).ok,false);
});

test('G12 rechecks expiry after claim and before provider send',async()=>{
 let sends=0,clock=0;
 const worker=createDeliveryPushWorker({workerId:a,now:()=>clock,
  claim:async()=>{clock=2000;return {...claimData(),expiresAtMs:5000};},
  sendToProvider:async()=>{sends++;return {accepted:true,ticketId:'ticket_12345'};},
  ack:async()=>true});
 assert.equal((await worker.processOne()).ok,false);
 assert.equal(sends,0);
});

test('G12 retry uses the same provider idempotency key after ACK failure',async()=>{
 const keys=[];
 const worker=createDeliveryPushWorker({workerId:a,claim:async()=>claimData(),
  sendToProvider:async x=>{keys.push(x.idempotencyKey);return {accepted:true,ticketId:'ticket_12345'};},
  ack:async()=>false});
 assert.equal((await worker.processOne()).ok,false);
 assert.equal((await worker.processOne()).ok,false);
 assert.deepEqual(keys,[`delivery-offer-${a}`,`delivery-offer-${a}`]);
});
