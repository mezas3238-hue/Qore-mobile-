import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1AdminTripIntegrityFence} from './f1-admin-trip-integrity-fence.mjs';

const uuid=n=>'70750000-0000-4707-8707-'+String(n).padStart(12,'0');
const tripId=uuid(1);
const base=()=>({tripId,routeId:uuid(2),quoteId:uuid(3),
 bookingRequestKey:uuid(4),service:'economico',amountGs:17500,
 currency:'PYG',fareVersion:'g75-v1',revision:1,
 observedAt:1900000000000,status:'searching',assignmentPersisted:false,
 qaOnly:true,productionEnabled:false});
test('same trip progresses from searching via persisted assignment to terminal, without resurrection',()=>{
 const fence=createF1AdminTripIntegrityFence();
 const v1=base(),v2={...v1,revision:2,observedAt:v1.observedAt+100,
  status:'assigned',assignmentPersisted:true};
 const v3={...v2,revision:3,status:'arriving',observedAt:v2.observedAt+100};
 const v4={...v3,revision:4,status:'in_progress',observedAt:v3.observedAt+100};
 const v5={...v4,revision:5,status:'completed',observedAt:v4.observedAt+100};
 for(const proof of [v1,v2,v3,v4,v5])
  assert.equal(fence.observe(proof).ok,true);
 assert.equal(fence.observe({...v5,revision:6,status:'assigned',
  observedAt:v5.observedAt+100}).code,'F1_ADMIN_TERMINAL_RESURRECTION');
});
test('reject old revisions, older snapshots and conflicting same-revision state',()=>{
 const f=createF1AdminTripIntegrityFence(),b=base();
 assert.equal(f.observe({...b,revision:4,observedAt:b.observedAt+400,
  status:'assigned',assignmentPersisted:true}).ok,true);
 assert.equal(f.observe({...b,revision:3}).code,'F1_ADMIN_STALE_REVISION');
 assert.equal(f.observe({...b,revision:4,observedAt:b.observedAt+350,
  status:'assigned',assignmentPersisted:true}).code,'F1_ADMIN_STALE_REVISION');
 assert.equal(f.observe({...b,revision:4,observedAt:b.observedAt+500,
  status:'arriving',assignmentPersisted:true}).code,'F1_ADMIN_CONFLICTING_REVISION');
 assert.equal(f.observe({...b,revision:5,observedAt:b.observedAt+600,
  status:'searching',assignmentPersisted:true}).code,'F1_ADMIN_STATUS_REGRESSION');
});
test('trip identity, route, quote, accepted price, request and fare version never change',()=>{
 for(const patch of [{tripId:uuid(8)},{routeId:uuid(9)},
  {quoteId:uuid(9)},{bookingRequestKey:uuid(9)},
  {service:'xl'},{amountGs:1},{fareVersion:'changed'},
  {currency:'USD'}]){
  const f=createF1AdminTripIntegrityFence(),b=base();
  assert.equal(f.observe(b).ok,true);
  const next={...b,...patch,revision:2,observedAt:b.observedAt+100};
  const r=f.observe(next);
  if(patch.tripId){
   // Different trips may be read separately by the same Admin session.
   assert.equal(r.ok,true);
  }else assert.equal(r.code,'F1_ADMIN_TRIP_LINK_CHANGED',JSON.stringify(patch));
 }
});
test('cannot fabricate completed ride or remove persisted assignment',()=>{
 const f=createF1AdminTripIntegrityFence(),b=base();
 assert.equal(f.observe({...b,status:'completed'}).code,
  'F1_ADMIN_COMPLETION_UNVERIFIED');
 assert.equal(f.observe(b).ok,true);
 assert.equal(f.observe({...b,revision:2,status:'assigned',
  assignmentPersisted:true,observedAt:b.observedAt+100}).ok,true);
 assert.equal(f.observe({...b,revision:3,status:'cancelled',
  assignmentPersisted:false,observedAt:b.observedAt+200}).code,
  'F1_ADMIN_ASSIGNMENT_REGRESSION');
 assert.equal(f.observe({...b,revision:3,status:'cancelled',
  assignmentPersisted:true,observedAt:b.observedAt+200}).ok,true);
 assert.equal(f.observe({...b,revision:4,status:'assigned',
  assignmentPersisted:true,observedAt:b.observedAt+300}).code,
  'F1_ADMIN_TERMINAL_RESURRECTION');
});
test('repeated identical revision with fresher timestamp is safe, reset happens only on new session',()=>{
 const f=createF1AdminTripIntegrityFence(),b=base();
 assert.equal(f.observe(b).ok,true);
 assert.equal(f.observe({...b,observedAt:b.observedAt+150}).ok,true);
 assert.equal(f.observe({...b,observedAt:b.observedAt+100}).code,
  'F1_ADMIN_STALE_REVISION');
 f.clear();
 assert.equal(f.observe({...b,observedAt:b.observedAt+100}).ok,true);
});
