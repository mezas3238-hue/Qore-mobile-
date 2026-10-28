import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAcceptedDriverAutoResume as verify} from './driver-accepted-ride-resume.mjs';
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
