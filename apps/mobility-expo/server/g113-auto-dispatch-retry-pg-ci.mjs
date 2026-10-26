/**
 * G113 disposable CI: a server worker automatically claims persisted G98
 * Passenger retry, observes G85 30-second backoff, reattempts only when due,
 * and cannot resurrect the booking after real G95/G96 cancellation.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG113AutoDispatchRetryWorker,
 createG113AutoDispatchBatchRepository}
 from './g113-auto-dispatch-retry-worker.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain'||
 process.env.PGPORT!=='5432')
 throw Error('G113 refuses non-disposable PostgreSQL runtime');
const passenger='98980000-0000-4989-8989-000000000003';
const key='98980000-0000-4989-8989-000000000031';
const cancelKey='11300000-0000-4113-8113-000000000031';
function sql(query){
 const out=execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8',
   timeout:15000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
const json=query=>JSON.parse(sql(query));
const current=()=>json("SELECT jsonb_build_object("+
 "'status',j.status,'attempts',j.attempts,'offerId',j.offer_id,"+
 "'due',j.next_attempt_at<=pg_catalog.clock_timestamp(),"+
 "'tripState',t.status,'tripId',j.trip_id,'passengerId',j.passenger_id)"+
 "::text FROM public.mobility_stage_g85_auto_dispatch_jobs j "+
 "JOIN public.mobility_stage_auto_demo_trips t ON t.id=j.trip_id "+
 "WHERE j.booking_key='"+key+"'");
assert.equal(sql("SELECT (current_database()='qore_disposable_chain' AND "+
 "current_setting('application_name')='qore_ci_disposable_chain')::text"),'true');
assert.equal(sql("SELECT has_function_privilege('service_role',"+
 "'public.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')::text"),
 'true');
assert.equal(sql("SELECT has_function_privilege('authenticated',"+
 "'public.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')::text"),
 'false');
assert.equal(sql("SELECT has_table_privilege('service_role',"+
 "'public.mobility_stage_g85_auto_dispatch_jobs','SELECT')::text"),'false');
const before=current();
assert.equal(before.status,'PENDING');
assert.equal(before.attempts,0);assert.equal(before.offerId,null);
assert.equal(before.tripState,'searching');
assert.equal(before.passengerId,passenger);
assert.equal(before.due,true);
let rpcCalls=0;
const repository=createG113AutoDispatchBatchRepository({
 rpc:async(name,params)=>{
  assert.equal(name,'mobility_stage_g113_run_due_auto_batch_qa');
  assert.deepEqual(params,{_limit:1});
  rpcCalls++;
  return {data:json("SET ROLE service_role; SELECT "+
   "public.mobility_stage_g113_run_due_auto_batch_qa(1)::text"),
   error:null};
 }
});
let scheduled=null,stopCount=0;
const worker=createG113AutoDispatchRetryWorker({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 runDueBatch:input=>repository.runDueBatch(input),
 maxJobs:1,intervalMs:30000,
 schedule:(cb,ms)=>{
  assert.equal(ms,30000);scheduled=cb;return {unref(){}};
 },
 cancel:()=>{stopCount++;}
});
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
assert.equal(worker.start(),true);
await settle(); // first due batch is automatically invoked on server start
assert.equal(rpcCalls,1);
const first=current();
assert.equal(first.status,'WAITING');
assert.equal(first.attempts,1);
assert.equal(first.offerId,null,'No forged offer without G71/G38');
assert.equal(first.tripState,'searching');
assert.equal(first.due,false,'G85 persisted 30-second retry backoff');
const notDue=await worker.tick();
assert.equal(notDue.ok,true);
assert.equal(notDue.result.processed,0);
assert.equal(current().attempts,1,'Premature cron wakeup must be harmless');
// Simulate the passage of 30s *in disposable CI only*. The actual worker
// never changes due timestamps, and service_role cannot update this table.
sql("UPDATE public.mobility_stage_g85_auto_dispatch_jobs "+
 "SET next_attempt_at=pg_catalog.clock_timestamp()-interval '1 second' "+
 "WHERE booking_key='"+key+"' AND attempts=1 AND status='WAITING'");
assert.equal(current().due,true);
scheduled();await settle();
const second=current();
assert.equal(second.status,'WAITING');
assert.equal(second.attempts,2,'Second due attempt persisted exactly once');
assert.equal(second.offerId,null);
assert.equal(second.due,false);
assert.equal(second.tripId,first.tripId);
const canceled=json("SET ROLE service_role; SELECT "+
 "public.mobility_stage_g95_cancel_booked_auto_qa('"+passenger+"','"+
 key+"','"+cancelKey+"')::text");
assert.equal(canceled.tripState,'cancelled');
const afterCancel=current();
assert.equal(afterCancel.tripState,'cancelled');
assert.equal(afterCancel.status,'CLOSED');
assert.equal(afterCancel.attempts,2);
assert.equal(afterCancel.offerId,null);
const afterTick=await worker.tick();
assert.equal(afterTick.ok,true);
assert.equal(afterTick.result.processed,0);
assert.equal(current().attempts,2,'Canceled booking must never retry');
worker.stop();assert.equal(stopCount,1);
const reads=rpcCalls;scheduled();await settle();
assert.equal(rpcCalls,reads,'Stopped worker has no further SQL side effects');
assert.equal(worker.snapshot().running,false);
console.log('G113 PASS: real PG16 automatic server startup + due tick -> WAITING 30-second backoff -> due retry attempts 1->2 -> G95/G96 canceled CLOSED; no extra worker, no offer/Driver/G38 bypass, no LIVE.');
