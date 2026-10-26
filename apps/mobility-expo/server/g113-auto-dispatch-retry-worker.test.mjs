import test from 'node:test';
import assert from 'node:assert/strict';
import {createG113AutoDispatchRetryWorker,createG113AutoDispatchBatchRepository}
 from './g113-auto-dispatch-retry-worker.mjs';
const batch={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 processed:1,waiting:1,offered:0,closed:0,exhausted:0};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(overrides={}){
 let fire=null,canceled=0,reads=0;
 const scheduler={schedule:fn=>{fire=fn;return {unref(){}};},
  cancel:()=>{canceled++;}};
 const worker=createG113AutoDispatchRetryWorker({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  runDueBatch:async({limit})=>{reads++;assert.equal(limit,5);return batch;},
  ...scheduler,...overrides
 });
 return {worker,fire:()=>fire?.(),reads:()=>reads,canceled:()=>canceled};
}
test('G113 auto-starts first due check, then bounded repeating server ticks',async()=>{
 const f=fixture();
 assert.equal(f.worker.start(),true);
 await flush();assert.equal(f.reads(),1);
 assert.equal(f.worker.start(),false);
 f.fire();await flush();assert.equal(f.reads(),2);
 const result=await f.worker.tick();
 assert.equal(result.ok,true);
 assert.equal(result.result.processed,1);
 assert.equal(result.result.productionEnabled,false);
 f.worker.stop();assert.equal(f.canceled(),1);
 f.fire();await flush();assert.equal(f.reads(),3);
});
test('G113 prevents concurrent batch storms and discards stop-after-response',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);
 let called=0,scheduled;
 const worker=createG113AutoDispatchRetryWorker({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  runDueBatch:()=>{called++;return pending;},
  schedule:fn=>{scheduled=fn;return {unref(){}};},cancel:()=>{}
 });
 assert.equal(worker.start(),true);
 const refused=await worker.tick();
 assert.equal(refused.reason,'BUSY');assert.equal(called,1);
 scheduled();assert.equal(called,1);
 worker.stop();finish(batch);await flush();
 assert.equal(worker.snapshot().running,false);
 assert.equal((await worker.tick()).reason,'NOT_RUNNING');
});
test('G113 rejects bad SQL receipt, excessive budget and unavailable worker',async()=>{
 for(const data of [
  {...batch,processed:2},{...batch,commercialEnabled:true},
  {...batch,waiting:11,processed:11},
  {...batch,driverId:'private'},null
 ]){
  const f=fixture({runDueBatch:async()=>data});
  f.worker.start();await flush();
  assert.equal((await f.worker.tick()).reason,'SQL_UNAVAILABLE');
  f.worker.stop();
 }
 for(const maxJobs of [0,11,-1,null]){
  assert.throws(()=>createG113AutoDispatchRetryWorker({
   environment:'isolated_staging',qaOnly:true,liveEnabled:false,
   runDueBatch:async()=>batch,maxJobs
  }));
 }
 assert.throws(()=>createG113AutoDispatchRetryWorker());
});
test('G113 server-only adapter invokes dedicated SQL with bounded typed limit',async()=>{
 let args;
 const repo=createG113AutoDispatchBatchRepository({rpc:async(name,input)=>{
  args={name,input};return {data:batch,error:null};
 }});
 assert.equal((await repo.runDueBatch({limit:5})).processed,1);
 assert.deepEqual(args,{name:'mobility_stage_g113_run_due_auto_batch_qa',
  input:{_limit:5}});
 await assert.rejects(repo.runDueBatch({limit:99}));
 await assert.rejects(createG113AutoDispatchBatchRepository({
  rpc:async()=>({data:{...batch,driverId:'leak'},error:null})
 }).runDueBatch({limit:5}));
 assert.throws(()=>createG113AutoDispatchBatchRepository());
});
