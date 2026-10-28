import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptAndRecoverDriverAuto} from './driver-auto-accept-flow.mjs';
const id=n=>'10c00000-0000-40c0-80c0-'+String(n).padStart(12,'0');
const decision={offerId:id(1),serviceId:id(2),kind:'AUTO_RIDE',
 action:'accept',phase:'confirmed'};
const current={tripId:id(2),status:'accepted',revision:2};
test('C17 accepted AUTO opens only with private GET matching same SQL trip',async()=>{
 const events=[];
 const result=await acceptAndRecoverDriverAuto({
  offerId:id(1),
  decide:async(offerId,action)=>{
   events.push(['POST',offerId,action]);return decision;},
  recoverCurrent:async()=>{
   events.push(['GET','current']);return current;}
 });
 assert.deepEqual(result,{ok:true,tripId:id(2)});
 assert.deepEqual(events,[['POST',id(1),'accept'],['GET','current']]);
});
test('C17 invalid or unconfirmed decisions never read a trip or resubmit',async()=>{
 for(const receipt of [
  null,{...decision,phase:'uncertain'},{...decision,phase:'sending'},
  {...decision,phase:'blocked'},{...decision,action:'decline'},
  {...decision,kind:'DELIVERY'},{...decision,offerId:id(9)}
 ]){
  let posts=0,reads=0;
  const out=await acceptAndRecoverDriverAuto({offerId:id(1),
   decide:async()=>{posts++;return receipt},
   recoverCurrent:async()=>{reads++;return current}
  });
  assert.equal(out.ok,false);
  assert.equal(posts,1);
  assert.equal(reads,0);
 }
});
test('C17 driver rejects foreign, terminal, stale or revoked assignments',async()=>{
 for(const row of [null,{...current,tripId:id(9)},
  {...current,status:'completed'},{...current,status:'cancelled'},
  {...current,revision:1}]){
  let calls=0;
  const result=await acceptAndRecoverDriverAuto({offerId:id(1),
   decide:async()=>{calls++;return decision},
   recoverCurrent:async()=>row
  });
  assert.equal(result.ok,false);
  assert.equal(calls,1);
 }
 const failed=await acceptAndRecoverDriverAuto({offerId:id(1),
  decide:async()=>decision,
  recoverCurrent:async()=>{throw Error('revoked')}
 });
 assert.equal(failed.ok,false);
});
test('C17 invalid offer ID fails closed before POST',async()=>{
 let posts=0;
 const result=await acceptAndRecoverDriverAuto({
  offerId:'anything',decide:async()=>{posts++},
  recoverCurrent:async()=>current
 });
 assert.deepEqual(result,{ok:false,reason:'INVALID_REQUEST'});
 assert.equal(posts,0);
});
