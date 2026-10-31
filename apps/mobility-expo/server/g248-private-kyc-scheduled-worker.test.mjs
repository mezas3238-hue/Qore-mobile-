import test from 'node:test';
import assert from 'node:assert/strict';
import {createG248PrivateKycPgRepository,
 createG248PrivateKycScheduledWorker,G248_DOCUMENT_MONITOR_LIVE_ENABLED
} from './g248-private-kyc-scheduled-worker.mjs';

const id='24800000-0000-4248-8248-000000000001';
const done=(extra={})=>({
 mode:'STAGING_DEMO_ONLY',status:'PROCESSED',
 processed:3,inserted:2,duplicate:1,cycleCompleted:false,
 resumeCursor:id,checkpointRevision:7,
 qaOnly:true,productionEnabled:false,driverDispatchAuthorized:false,...extra
});
const busy=()=>({mode:'STAGING_DEMO_ONLY',status:'BUSY',
 qaOnly:true,productionEnabled:false,driverDispatchAuthorized:false});
const repo=(rpc)=>createG248PrivateKycPgRepository({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 client:{rpc}
});
const worker=(options={})=>createG248PrivateKycScheduledWorker({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 repository:{runBatch:async()=>({
  status:'PROCESSED',processed:1,inserted:1,duplicate:0,
  cycleCompleted:false,checkpointRevision:1,
  qaOnly:true,productionEnabled:false})},...options
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('G248 never starts production and sends bounded owner SQL RPC',async()=>{
 assert.equal(G248_DOCUMENT_MONITOR_LIVE_ENABLED,false);
 const calls=[];
 const pg=repo(async(name,args)=>{
  calls.push({name,args});
  return {data:done(),error:null};
 });
 assert.deepEqual(await pg.runBatch({limit:3}),{
  status:'PROCESSED',processed:3,inserted:2,duplicate:1,
  cycleCompleted:false,checkpointRevision:7,
  qaOnly:true,productionEnabled:false});
 assert.deepEqual(calls,[{name:'mobility_stage_g248_run_due_kyc_batch_owner_qa',
  args:{_limit:3}}]);
});
test('G248 respects another replica lock, not an error or fake completion',async()=>{
 const pg=repo(async()=>({data:busy(),error:null}));
 assert.deepEqual(await pg.runBatch({limit:4}),{
  status:'BUSY',qaOnly:true,productionEnabled:false});
 const w=worker({repository:pg});
 // worker default 50 would also be valid
 const callbacks=[];
 const sync=worker({repository:pg,schedule:(fn)=>{callbacks.push(fn);return 1;}});
 assert.equal(sync.start(),true);
 await flush();
 assert.deepEqual(await sync.tick(),{
  ok:false,reason:'ANOTHER_INSTANCE_RUNNING'});
 sync.stop();
 assert.equal(w.snapshot().running,false);
});
test('G248 rejects SQL receipts claiming LIVE, wrong checkpoint or extra fields',async()=>{
 const invalid=[
  done({productionEnabled:true}),done({driverDispatchAuthorized:true}),
  done({resumeCursor:'invalid'}),done({checkpointRevision:0}),
  done({inserted:4}),done({cycleCompleted:true}),
  done({processed:55}),done({driverPhone:'private'}),
  busy() && {...busy(),privateText:'leak'},
  {...busy(),productionEnabled:true}
 ];
 for(const value of invalid)
  await assert.rejects(repo(async()=>({data:value})).runBatch({limit:4}),
   /G248_UNTRUSTED_SQL_RECEIPT/);
});
test('G248 fails closed on SQL exceptions and inconsistent payloads',async()=>{
 await assert.rejects(repo(async()=>{throw Error('database includes a secret')})
  .runBatch({limit:4}),/G248_DATABASE_UNAVAILABLE/);
 await assert.rejects(repo(async()=>({error:'denied',data:null}))
  .runBatch({limit:4}),/G248_DATABASE_UNAVAILABLE/);
 await assert.rejects(repo(async()=>({data:{}}))
  .runBatch({limit:4}),/G248_UNTRUSTED_SQL_RECEIPT/);
});
test('G248 autonomous start and stop: no overlap, recover immediately',async()=>{
 const scheduled=[],cancelled=[];
 let resolve;
 const invoked=[];
 const w=worker({repository:{runBatch:async input=>{
  invoked.push(input);
  return await new Promise(r=>{resolve=r;});
 }},maxDocuments:4,intervalMs:60000,
  schedule:(fn,ms)=>{scheduled.push({fn,ms});return {id:5};},
  cancel:timer=>cancelled.push(timer.id)
 });
 assert.equal(w.snapshot().running,false);
 assert.equal(w.start(),true);
 assert.equal(w.start(),false);
 assert.equal(w.snapshot().inFlight,true);
 assert.equal(scheduled[0].ms,60000);
 assert.deepEqual(await w.tick(),{ok:false,reason:'OVERLAPPING'});
 resolve({status:'PROCESSED',processed:4,inserted:4,duplicate:0,
  cycleCompleted:true,checkpointRevision:3,
  qaOnly:true,productionEnabled:false});
 await flush();
 assert.equal(w.snapshot().inFlight,false);
 assert.deepEqual(invoked,[{limit:4}]);
 w.stop();
 assert.deepEqual(cancelled,[5]);
 assert.deepEqual(await w.tick(),{ok:false,reason:'NOT_RUNNING'});
 assert.equal(w.snapshot().running,false);
});
test('G248 stop during SQL query does not claim monitor is running',async()=>{
 let resolve;
 const w=worker({repository:{runBatch:()=>new Promise(r=>{resolve=r;})},
  schedule:()=>({id:4}),cancel:()=>{}});
 assert.equal(w.start(),true);
 w.stop();
 resolve({status:'PROCESSED',processed:0,inserted:0,duplicate:0,
  cycleCompleted:true,checkpointRevision:4,qaOnly:true,productionEnabled:false});
 await flush();
 assert.equal(w.snapshot().running,false);
});
test('G248 worker rejects forged repository receipts without leaking SQL',async()=>{
 const w=worker({repository:{runBatch:async()=>({
  status:'PROCESSED',processed:3,inserted:4,duplicate:0,
  cycleCompleted:true,checkpointRevision:1,qaOnly:true,productionEnabled:false
 })},schedule:()=>1,cancel:()=>{}});
 w.start();await flush();
 assert.deepEqual(await w.tick(),{ok:false,reason:'PRIVATE_SQL_UNAVAILABLE'});
 w.stop();
});
test('G248 refuses production or invalid limits',async()=>{
 for(const opts of [{environment:'production'},{liveEnabled:true},
  {qaOnly:false},{intervalMs:10},{maxDocuments:500},{repository:null}]){
  assert.throws(()=>worker(opts),/G248_STAGING_SCHEDULER_REQUIRED/);
 }
 for(const opts of [{environment:'production'},{liveEnabled:true},
  {qaOnly:false},{client:null}]){
  assert.throws(()=>createG248PrivateKycPgRepository({
   environment:'isolated_staging',qaOnly:true,liveEnabled:false,
   client:{rpc:async()=>({data:done()})},...opts
  }),/G248_PRIVATE_OWNER_PG_REQUIRED/);
 }
 const pg=repo(async()=>({data:done()}));
 for(const limit of [0,51,NaN,3.5])
  await assert.rejects(pg.runBatch({limit}),/G248_INVALID_BATCH/);
});
