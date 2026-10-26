/**
 * G113 disposable CI: a server worker automatically claims persisted G98
 * Passenger retry, observes G85 30-second backoff, reattempts only when due,
 * and cannot resurrect the booking after real G95/G96 cancellation.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG115LocalQaAutoDispatchRuntime}
 from './g115-local-qa-auto-dispatch-runtime.mjs';
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
const pgClient={rpc:async(name,args)=>{
 // This client is allowed ONLY on the already-proved disposable PG16.
 // G90 is read privately; G112 can touch only the scoped original booking;
 // G113 claims only due jobs, all with service_role SQL grants.
 if(name==='mobility_stage_g113_run_due_auto_batch_qa'){
  assert.deepEqual(args,{_limit:1});
  rpcCalls++;
  return {data:json("SET ROLE service_role; SELECT "+
   "public.mobility_stage_g113_run_due_auto_batch_qa(1)::text"),error:null};
 }
 const parameters={
  mobility_stage_g90_passenger_dispatch_status_qa:['_passenger_id','_booking_key'],
  mobility_stage_g112_run_booked_auto_dispatch_qa:
   ['_passenger_id','_booking_key','_trip_id']
 }[name];
 if(!parameters||Object.keys(args).length!==parameters.length||
  !parameters.every(k=>Object.hasOwn(args,k)&&
   /^[0-9a-f-]{36}$/i.test(args[k])))
  throw Error('G115 attempted unapproved private SQL');
 const result=json('SET ROLE service_role; SELECT public.'+name+'('+
  parameters.map(k=>"'"+args[k]+"'").join(',')+')::text');
 return {data:result,error:null};
}};
let scheduled=null,stopCount=0;
const worker=createG115LocalQaAutoDispatchRuntime({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 client:pgClient,
 readPrivateDispatchStatus:async({actorId,requestKey})=>{
  assert.equal(actorId,passenger);
  assert.equal(requestKey,key);
  const {data}=await pgClient.rpc('mobility_stage_g90_passenger_dispatch_status_qa',{
   _passenger_id:actorId,_booking_key:requestKey
  });
  return data;
 },
 maxJobs:1,intervalMs:30000,
 schedule:(cb,ms)=>{
  assert.equal(ms,30000);scheduled=cb;return {unref(){}};
 },
 cancel:()=>{stopCount++;}
});
// Real G73 booking in G98 receives exactly one G112 scoped initial dispatch;
// G113 then only retries the SAME persisted trip when PostgreSQL says due.
const dispatched=await worker.dispatchBookedAuto({
 passengerId:passenger,bookingKey:key,tripId:before.tripId
});
assert.equal(dispatched.ok,true,JSON.stringify(dispatched));
assert.equal(dispatched.attemptExecuted,true);
assert.equal(dispatched.dispatchState,'RETRY_PENDING');
assert.equal(current().attempts,1);
assert.equal(current().tripId,before.tripId);
const settle=async()=>{
 // The initial tick is asynchronous. Wait for completion, not merely the
 // first SQL side effect, before triggering another simulated cron interval.
 for(let i=0;i<16;i++){
  if(!worker.snapshot().busy)return;
  await new Promise(resolve=>setImmediate(resolve));
 }
 assert.equal(worker.snapshot().busy,false,'G113 CI worker failed to settle');
};
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
console.log('G115 POSTGRES PASS: original G73 persisted trip -> G111 G90 scoped status -> G112 initial SQL dispatch -> G113 periodic non-due and due retry -> G95/G96 terminal cancellation, same tripId and legal G38/G71 fences, no LIVE.');
