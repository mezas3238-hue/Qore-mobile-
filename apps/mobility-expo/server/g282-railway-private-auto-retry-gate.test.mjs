import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 readG282RailwayAutoRetryOptIn,assertG282PrivateBatchInstalled,
 assertG283VerifiedDatabaseReadiness,startG282RailwayRetryWorker
} from './g282-railway-private-auto-retry-gate.mjs';

const ready={
 QORE_G113_AUTO_RETRY_QA_APPROVED:'true',
 QORE_G269_ROAD_EVIDENCE_READY:'true',
 QORE_DRIVER_COMPLIANCE_READY:'true',
 QORE_OWNER_AUTO_FARE_PUBLISHED:'true',
 QORE_STAGING_PROJECT_REF:'mrjzxftsdxzepzbcuids',
 QORE_MOBILITY_ENV:'staging',
 RAILWAY_ENVIRONMENT_NAME:'staging',
 QORE_RAILWAY_STAGING_APPROVED:'true',
 QORE_RAILWAY_NO_COMMERCIAL_TRIPS:'true',
 LIVE_TRIPS_ENABLED:'false'
};
const enabled=env=>readG282RailwayAutoRetryOptIn(env);
test('G282 must be OFF by default in every Railway STAGING launch',()=>{
 assert.equal(enabled({...ready,QORE_G113_AUTO_RETRY_QA_APPROVED:undefined}),false);
 assert.equal(enabled({...ready,QORE_G113_AUTO_RETRY_QA_APPROVED:'false'}),false);
 assert.equal(enabled({}),false);
});
test('G282 permits explicit safe STAGING QA opt-in only',()=>{
 assert.equal(enabled(ready),true);
 for(const [key,value] of Object.entries({
  QORE_STAGING_PROJECT_REF:'qdqrlgzlotnfdxzpacxs',
  QORE_MOBILITY_ENV:'production',
  RAILWAY_ENVIRONMENT_NAME:'production',
  QORE_RAILWAY_STAGING_APPROVED:'false',
  QORE_RAILWAY_NO_COMMERCIAL_TRIPS:'false',
  LIVE_TRIPS_ENABLED:'true',
  QORE_G269_ROAD_EVIDENCE_READY:'false',
  QORE_DRIVER_COMPLIANCE_READY:'false',
  QORE_OWNER_AUTO_FARE_PUBLISHED:undefined
 })){
  assert.throws(()=>enabled({...ready,[key]:value}),/G282/);
 }
 for(const val of ['1','TRUE','yes','False',true,0]){
  assert.throws(()=>enabled({...ready,QORE_G113_AUTO_RETRY_QA_APPROVED:val}),/G282/);
 }
});
test('G282 checks installed service-role private RPC using INVALID limit=0 without touching jobs',async()=>{
 let called=0;
 assert.equal(await assertG282PrivateBatchInstalled(async(name,args)=>{
  called++;
  assert.equal(name,'mobility_stage_g113_run_due_auto_batch_qa');
  assert.deepEqual(args,{_limit:0});
  return {data:null,error:{code:'P2694'}};
 }),true);
 assert.equal(called,1);
});
test('G282 blocks missing/unsafe/probing SQL responses before scheduling',async()=>{
 for(const v of [
  {data:null,error:{code:'PGRST202'}},
  {data:{processed:0},error:null},
  {data:null,error:{code:'42501'}},
  {data:null,error:{code:'23505'}},
  {data:null,error:null},
  {data:[],error:{code:'P2694'}},
  null
 ]){
  await assert.rejects(
   assertG282PrivateBatchInstalled(async()=>v),/G282/);
 }
 await assert.rejects(assertG282PrivateBatchInstalled(async()=>{
  throw Error('offline');
 }),/G282/);
});
test('G282 requires verified worker with idempotent stop, never implicit start',()=>{
 let starts=0,stops=0,running=false;
 const worker={
  start(){starts++;running=true;return true;},
  stop(){stops++;running=false;},
  snapshot(){return {running};}
 };
 let controller=startG282RailwayRetryWorker({worker,enabled:false});
 assert.equal(controller.started,false);
 assert.equal(starts,0);
 assert.equal(controller.stop(),false);
 controller=startG282RailwayRetryWorker({worker,enabled:true});
 assert.equal(controller.started,true);
 assert.equal(starts,1);
 assert.equal(controller.stop(),true);
 assert.equal(controller.stop(),false);
 assert.equal(stops,1);
 assert.equal(running,false);
});
test('G282 rejects worker startup failure and no fabricated success',()=>{
 for(const worker of [
  null,{start:()=>false,stop(){},snapshot:()=>({running:false})},
  {start:()=>true,stop(){},snapshot:()=>({running:false})},
  {start(){throw Error('start failed');},stop(){},snapshot:()=>({running:true})}
 ]){
  assert.throws(()=>startG282RailwayRetryWorker({
   worker,enabled:true
  }),/G282/);
 }
});
test('G282 Railway entry point runs only after G256 and binds lifecycle shutdown',()=>{
 const source=readFileSync(new URL('./run-g4-railway-staging.mjs',import.meta.url),'utf8');
 const at=x=>source.indexOf(x);
 assert.ok(at('verifyG256RailwayLaunch')<at('await assertG282PrivateBatchInstalled'));
 assert.ok(at('await assertG282PrivateBatchInstalled')<
  at('autoDispatchRetryQa:g113RetryApproved'));
 assert.ok(at("await once(ingress,'listening')")<
  at('retryController=startG282RailwayRetryWorker('));
 assert.ok(at('retryController?.stop()')<at('ingress.close()'));
 assert.match(source,/enabled:g113RetryApproved/);
});

test('G283 accepts actual private read-only SQL readiness only when both approvals are real',async()=>{
 const good={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
  ownerAutoFareVerified:true,eligibleAutoDriverVerified:true,databaseReady:true};
 let calls=0;
 assert.equal(await assertG283VerifiedDatabaseReadiness(async(name,args)=>{
  calls++;
  assert.equal(name,'mobility_stage_g283_auto_retry_readiness_qa');
  assert.deepEqual(args,{});
  return {data:good,error:null};
 }),true);
 assert.equal(calls,1);
 for(const bad of [
  {...good,ownerAutoFareVerified:false,databaseReady:false},
  {...good,eligibleAutoDriverVerified:false,databaseReady:false},
  {...good,databaseReady:false},
  {...good,commercialEnabled:true},
  {...good,ownerId:'should_never_expose'},
  {...good,ownerAutoFareVerified:'true'},
  null
 ]){
  await assert.rejects(assertG283VerifiedDatabaseReadiness(
   async()=>({data:bad,error:null})),/G282/);
 }
 for(const error of [{code:'PGRST202'},{code:'42501'}]){
  await assert.rejects(assertG283VerifiedDatabaseReadiness(
   async()=>({data:null,error})),/G282/);
 }
});
test('G283 Railway cannot schedule even with all flags TRUE until DB certifies readiness',()=>{
 const source=readFileSync(new URL('./run-g4-railway-staging.mjs',import.meta.url),'utf8');
 const at=x=>source.indexOf(x);
 assert.ok(at('await assertG283VerifiedDatabaseReadiness')>
  at('await assertG282PrivateBatchInstalled'));
 assert.ok(at('await assertG283VerifiedDatabaseReadiness')<
  at('autoDispatchRetryQa:g113RetryApproved'));
 assert.ok(at('autoDispatchRetryQa:g113RetryApproved')<
  at('retryController=startG282RailwayRetryWorker'));
});
