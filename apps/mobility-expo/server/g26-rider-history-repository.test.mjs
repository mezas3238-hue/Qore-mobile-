import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreOwnHistoryRepository} from './g26-rider-history-repository.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const ride='33333333-3333-4333-8333-333333333333';
const delivery='44444444-4444-4444-8444-444444444444';
const order='55555555-5555-4555-8555-555555555555';
function fixture(overrides={}){
 const calls=[];
 const rows={
  mobility_stage_auto_demo_trips:[{id:ride,passenger_id:owner,status:'accepted',
   revision:2,created_at:'2026-10-22T12:00:00Z'}],
  mobility_stage_deliveries:[{id:delivery,sender_id:owner,status:'delivered',
   revision:3,created_at:'2026-10-22T13:00:00Z'}],
  mobility_stage_merchant_orders:[{id:order,buyer_id:owner,status:'preparing',
   revision:1,created_at:'2026-10-22T14:00:00Z'}],
  ...overrides
 };
 const db={
  from(table){
   let actor;
   const chain={
    select(cols){calls.push({table,cols});return this;},
    eq(column,id){actor={column,id};return this;},
    order(){return this;},
    async limit(size){
     assert.equal(size,51);
     const data=rows[table];
     if(!Array.isArray(data))return {data:null,error:{code:'42P01'}};
     return {data:data.filter(x=>x[actor.column]===actor.id),error:null};
    }
   };
   return chain;
  }
 };
 return {calls,load:createQoreOwnHistoryRepository(db)};
}
test('three owner-scoped sources map statuses and omit PII in chronological order',async()=>{
 const {load,calls}=fixture();
 const out=await load({ownerId:owner,limit:51});
 assert.deepEqual(out,[
  {serviceId:order,kind:'MERCHANT_ORDER',status:'in_progress',
   revision:1,createdAt:Date.parse('2026-10-22T14:00:00Z')},
  {serviceId:delivery,kind:'DELIVERY',status:'completed',
   revision:3,createdAt:Date.parse('2026-10-22T13:00:00Z')},
  {serviceId:ride,kind:'RIDE',status:'assigned',
   revision:2,createdAt:Date.parse('2026-10-22T12:00:00Z')}
 ]);
 assert.equal(calls.length,3);
 assert.ok(calls.every(q=>/id,.*status,revision,created_at/.test(q.cols)));
 assert.doesNotMatch(JSON.stringify(out),/sender_id|passenger_id|buyer_id|plate|phone|amount/);
});
test('uninstalled G6 and over-limit history fail closed, never silent partial list',async()=>{
 await assert.rejects(fixture({mobility_stage_merchant_orders:null}).load({
  ownerId:owner,limit:51
 }));
 const records=Array.from({length:51},(_,i)=>({id:i.toString(16).padStart(8,'0')+
  '-3333-4333-8333-333333333333',passenger_id:owner,status:'searching',
  revision:1,created_at:'2026-10-22T12:00:00Z'}));
 await assert.rejects(fixture({mobility_stage_auto_demo_trips:records}).load({
  ownerId:owner,limit:51
 }),/pagination/);
});
test('malformed, unauthorized or cross-owner rows always reject',async()=>{
 for(const row of [
  {id:ride,passenger_id:owner,status:'invalid',revision:1,created_at:'2026-10-22T12:00:00Z'},
  {id:ride,passenger_id:owner,status:'searching',revision:0,created_at:'2026-10-22T12:00:00Z'},
  {id:ride,passenger_id:owner,status:'searching',revision:1,created_at:'bad-clock'},
 ]){
  await assert.rejects(fixture({mobility_stage_auto_demo_trips:[row]}).load({
   ownerId:owner,limit:51
  }));
 }
 const {load}=fixture();
 await assert.rejects(load({ownerId:other,limit:50}));
});
