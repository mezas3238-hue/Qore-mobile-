import test from 'node:test';
import assert from 'node:assert/strict';
import {createServiceTraceIntegrityFence} from './service-trace-integrity-fence.mjs';
const id=n=>'d0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const build=(status='requested',revision=1)=>({
 serviceId:id(1),serviceKind:'AUTO_DELIVERY',bookingRequestKey:id(2),
 quoteId:id(3),status,revision,observedAt:1000+revision,
 assignment:{state:'NOT_ASSIGNABLE',legalGate:'G71_BLOCKED'},
 events:[{eventId:id(4),serviceId:id(1),sequence:1,status:'requested',at:1000}],
 ledger:null
});
test('D trace accepts monotonic same-ID reservation then delivery progress',()=>{
 const guard=createServiceTraceIntegrityFence();
 assert.equal(guard.observe(build()).ok,true);
 const later=build('picked_up',2);
 later.events.push({eventId:id(5),serviceId:id(1),sequence:2,
  status:'picked_up',at:1001});
 assert.equal(guard.observe(later).ok,true);
});
test('D refuses stale PostgreSQL revision after a newer snapshot',()=>{
 const guard=createServiceTraceIntegrityFence();
 const later=build('picked_up',2);
 later.events.push({eventId:id(5),serviceId:id(1),sequence:2,
  status:'picked_up',at:1001});
 assert.equal(guard.observe(later).ok,true);
 assert.equal(guard.observe(build()).code,'TRACE_STALE_REVISION');
});
test('D cannot substitute booking request or quote for same serviceId',()=>{
 for(const field of ['quoteId','bookingRequestKey','serviceKind']){
  const guard=createServiceTraceIntegrityFence();guard.observe(build());
  const other=build('requested',2);
  other[field]=field==='serviceKind'?'MOTO_DELIVERY':id(31);
  assert.equal(guard.observe(other).code,'TRACE_IMMUTABLE_LINK_CHANGED');
 }
});
test('D blocks history rewrite, truncation, terminal resurrection',()=>{
 const guard=createServiceTraceIntegrityFence();
 const delivered=build('delivered',2);
 delivered.events.push({eventId:id(5),serviceId:id(1),sequence:2,
  status:'delivered',at:1001});
 guard.observe(delivered);
 const reopen=build('picked_up',3);
 reopen.events.push({eventId:id(5),serviceId:id(1),sequence:2,
  status:'picked_up',at:1001});
 assert.equal(guard.observe(reopen).code,'TRACE_TERMINAL_RESURRECTION');
 const shorter=build('delivered',3);
 assert.equal(guard.observe(shorter).code,'TRACE_HISTORY_TRUNCATED');
 const modified={...delivered,revision:3,observedAt:1003,
  events:[{...delivered.events[0],eventId:id(8)},delivered.events[1]]};
 assert.equal(guard.observe(modified).code,'TRACE_HISTORY_REWRITTEN');
});
test('D refuses conflicting amount at the same revision or edited reconciled ledger',()=>{
 const guard=createServiceTraceIntegrityFence();
 const first=build('delivered',2);
 first.events.push({eventId:id(5),serviceId:id(1),sequence:2,
  status:'delivered',at:1001});
 first.ledger={serviceId:id(1),currency:'PYG',grossGs:35000,
  platformCommissionGs:3000,customerSubsidyGs:3500,
  driverPayoutGs:28000,reconciliationStatus:'RECONCILED'};
 assert.equal(guard.observe(first).ok,true);
 const changed={...first,ledger:{...first.ledger,grossGs:45000}};
 assert.equal(guard.observe(changed).code,'TRACE_CONFLICTING_REVISION');
 assert.equal(guard.observe({...changed,revision:3,observedAt:1003}).code,
  'TRACE_RECONCILED_LEDGER_CHANGED');
});
test('D clearing identity also clears previous trace baseline',()=>{
 const guard=createServiceTraceIntegrityFence();
 const later=build('delivered',3);
 later.events.push({eventId:id(5),serviceId:id(1),sequence:2,
  status:'delivered',at:1001});
 guard.observe(later);
 guard.clear();
 assert.equal(guard.observe(build()).ok,true);
});
