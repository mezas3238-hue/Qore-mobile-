/** G115 private composition: G111 + G112 scoped booking, G113 durable due retries.
 * Explicit local QA only. No starts, network binding, legal waivers or LIVE.
 */
import {createG111AfterBookingAutoDispatch} from './g111-after-booking-auto-dispatch.mjs';
import {createG112ScopedAutoDispatchRepository} from './g112-scoped-auto-dispatch-repository.mjs';
import {createG113AutoDispatchRetryWorker,createG113AutoDispatchBatchRepository}
 from './g113-auto-dispatch-retry-worker.mjs';
export const G115_COMMERCIAL_ENABLED=false;
export function createG115LocalQaAutoDispatchRuntime({
 environment,qaOnly,liveEnabled,client,readPrivateDispatchStatus,
 maxJobs=5,intervalMs=30000,schedule,cancel
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  !client||typeof client.rpc!=='function'||
  typeof readPrivateDispatchStatus!=='function')
  throw Error('G115 requires private verified local QA and SQL');
 const scoped=createG112ScopedAutoDispatchRepository(client);
 const batches=createG113AutoDispatchBatchRepository(client);
 const first=createG111AfterBookingAutoDispatch({
  environment,qaOnly,liveEnabled,readPrivateDispatchStatus,
  runForBooking:x=>scoped.runForBooking(x)
 });
 const clock={};
 if(schedule!==undefined)clock.schedule=schedule;
 if(cancel!==undefined)clock.cancel=cancel;
 const worker=createG113AutoDispatchRetryWorker({
  environment,qaOnly,liveEnabled,maxJobs,intervalMs,
  runDueBatch:x=>batches.runDueBatch(x),...clock
 });
 return Object.freeze({
  dispatchBookedAuto:x=>first.dispatchBookedAuto(x),
  start:()=>worker.start(),stop:()=>worker.stop(),
  tick:()=>worker.tick(),snapshot:()=>worker.snapshot()
 });
}
