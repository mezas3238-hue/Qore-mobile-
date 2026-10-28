import test from 'node:test';
import assert from 'node:assert/strict';
import {createG86ManualDispatchRunner} from './g86-manual-dispatch-runner.mjs';
const tripId='86860000-0000-4868-8868-000000000021';
const offerId='86860000-0000-4868-8868-000000000022';
const receipt=(status,rest={})=>({data:{
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,status,...rest
},error:null});
const authorized=db=>createG86ManualDispatchRunner({
 database:db,environment:'isolated_qa_disposable',
 liveEnabled:false,manualQaApproved:true,maxClaims:3
});
test('G86 manually drains bounded SQL jobs; hides trip/driver IDs and never asserts LIVE or push',async()=>{
 const seen=[],answers=[
  receipt('OFFERED',{tripId,offerId}),
  receipt('WAITING',{tripId,offerId:null}),
  receipt('IDLE')
 ];
 const runner=authorized({rpc:async(n,arg)=>{seen.push({n,arg});return answers.shift();}});
 assert.deepEqual(await runner.drainOnce(),{
  mode:'ISOLATED_DISPOSABLE_QA_ONLY',commercialRidesEnabled:false,
  pushDelivered:false,claimedJobs:2,
  WAITING:1,OFFERED:1,CLOSED:0,EXHAUSTED:0
 });
 assert.deepEqual(seen,Array(3).fill(null).map(()=>({
  n:'mobility_stage_g85_run_one_dispatch_qa',arg:{}
 })));
});
test('G86 enforces max five jobs and never creates timers or repeat polling',async()=>{
 let calls=0;
 const worker=createG86ManualDispatchRunner({
  database:{rpc:async()=>{calls++;return receipt('WAITING',{tripId,offerId:null});}},
  environment:'isolated_qa_disposable',manualQaApproved:true,
  liveEnabled:false,maxClaims:5
 });
 const x=await worker.drainOnce();
 assert.equal(calls,5);assert.equal(x.claimedJobs,5);assert.equal(x.WAITING,5);
});
test('G86 rejects LIVE, missing manual approval and unbounded or invalid limits',()=>{
 const database={rpc:async()=>receipt('IDLE')};
 for(const bad of [{liveEnabled:true},{manualQaApproved:false},
  {environment:'staging'},{environment:'production'},
  {maxClaims:0},{maxClaims:6},{maxClaims:1.5},{database:null}]){
  assert.throws(()=>createG86ManualDispatchRunner({
   database,environment:'isolated_qa_disposable',
   liveEnabled:false,manualQaApproved:true,maxClaims:1,...bad
  }),/authorization/);
 }
});
test('G86 fails closed on lost ACK, SQL error or malformed driver/commit receipt',async()=>{
 const broken=[
  null,{data:null,error:null},{data:{status:'IDLE'},error:null},
  receipt('OFFERED',{tripId,offerId:null}),
  receipt('WAITING',{tripId,offerId}),
  receipt('CLOSED',{tripId,offerId}),
  receipt('IDLE',{offerId}),
  receipt('IDLE',{liveEnabled:true}),
  receipt('EXHAUSTED',{tripId:'invalid'}),
  {data:{mode:'LIVE',commercialEnabled:true,status:'IDLE'},error:null},
  {data:null,error:{message:'SQL unavailable'}}
 ];
 for(const item of broken){
  const worker=authorized({rpc:async()=>item});
  await assert.rejects(worker.drainOnce(),/G86/);
 }
 const worker=authorized({rpc:async()=>{throw Error('secret JWT 123');}});
 await assert.rejects(worker.drainOnce(),/^Error: G86 uncertain PostgreSQL worker outcome$/);
});
