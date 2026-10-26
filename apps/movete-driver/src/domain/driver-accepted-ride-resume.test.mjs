import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAcceptedDriverAutoResume as verify,
 verifyResumableDriverAutoTrip as resume} from './driver-accepted-ride-resume.mjs';
const id=n=>'10700000-0000-4107-8107-'+String(n).padStart(12,'0');
const decision={offerId:id(1),serviceId:id(2),
 kind:'AUTO_RIDE',action:'accept',phase:'confirmed'};
const valid={tripId:id(2),status:'accepted',revision:2};
test('G107 opens the same accepted trip after independent G106 read',async()=>{
 let calls=0;
 const r=await verify({decision,recoverCurrent:async()=>{
  calls++;return valid;
 }});
 assert.deepEqual(r,{ok:true,tripId:id(2)});
 assert.equal(calls,1);
 assert(!JSON.stringify(r).includes(id(1)));
});
test('G107 never reads for uncertain/declined/delivery/invalid accepted offer',async()=>{
 let calls=0;
 const recoverCurrent=async()=>{calls++;return valid;};
 for(const d of [
  {...decision,phase:'uncertain'},
  {...decision,phase:'sending'},
  {...decision,phase:'blocked'},
  {...decision,action:'decline'},
  {...decision,kind:'DELIVERY'},
  {...decision,offerId:'forged'},
  {...decision,serviceId:'forged'},
  null
 ]){
  const r=await verify({decision:d,recoverCurrent});
  assert.deepEqual(r,{ok:false,reason:'NOT_CONFIRMED'});
 }
 assert.equal(calls,0);
});
test('G107 rejects foreign, missing, terminal and unverified assignments',async()=>{
 for(const value of [
  null,
  {...valid,tripId:id(3)},
  {...valid,status:'cancelled'},
  {...valid,status:'completed'},
  {...valid,status:'searching'},
  {...valid,revision:1},
  {...valid,tripId:'forged'},
  {...valid,revision:null},
 ]){
  const r=await verify({decision,recoverCurrent:async()=>value});
  assert.deepEqual(r,{ok:false,reason:'UNVERIFIED_ASSIGNMENT'});
 }
});
test('G107 aborted authenticated read or provider revocation fails closed',async()=>{
 const fail=await verify({decision,recoverCurrent:async()=>{
  throw Error('session rotated during GET');
 }});
 assert.deepEqual(fail,{ok:false,reason:'UNVERIFIED_ASSIGNMENT'});
 assert.deepEqual(await verify({decision,recoverCurrent:null}),
 {ok:false,reason:'NOT_CONFIRMED'});
});

test('G121C a restarted Driver resumes ONLY same current SQL assignment',async()=>{
 let reads=0;
 const result=await resume({expectedTripId:id(2),minimumRevision:2,
  recoverCurrent:async()=>{reads++;return valid;}});
 assert.deepEqual(result,{ok:true,tripId:id(2)});
 assert.equal(reads,1);
});
test('G121C no navigation when accepted trip changed, regressed or ended',async()=>{
 for(const row of [
  null,{...valid,tripId:id(3)},
  {...valid,revision:1},{...valid,status:'completed'},
  {...valid,status:'cancelled'},{...valid,status:'searching'}
 ]){
  const result=await resume({expectedTripId:id(2),minimumRevision:2,
   recoverCurrent:async()=>row});
  assert.deepEqual(result,{ok:false,reason:'UNVERIFIED_ASSIGNMENT'});
 }
 assert.deepEqual(await resume({expectedTripId:id(2),minimumRevision:4,
  recoverCurrent:async()=>valid}),
  {ok:false,reason:'UNVERIFIED_ASSIGNMENT'});
});
test('G121C invalid ID, missing reader and revoked session fail closed',async()=>{
 let reads=0;
 const reader=async()=>{reads++;return valid;};
 for(const expectedTripId of ['forged',null,'']){
  assert.equal((await resume({expectedTripId,recoverCurrent:reader})).ok,false);
 }
 assert.equal(reads,0);
 assert.equal((await resume({expectedTripId:id(2),recoverCurrent:null})).ok,false);
 assert.equal((await resume({expectedTripId:id(2),
  recoverCurrent:async()=>{throw Error('revoked');}})).ok,false);
});
