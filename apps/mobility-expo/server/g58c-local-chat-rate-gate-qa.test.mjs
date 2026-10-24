import test from 'node:test';
import assert from 'node:assert/strict';
import {createG58CLocalChatRateGateQa} from './g58c-local-chat-rate-gate-qa.mjs';
const actor=n=>'58583000-0000-4858-8858-'+String(n).padStart(12,'0');
const QA={environment:'isolated_staging',localQaOnly:true,liveEnabled:false};
test('G58C limits total chat requests by verified actor, not client-selected operation',()=>{
 let now=Date.parse('2026-10-24T12:00:00Z');
 const gate=createG58CLocalChatRateGateQa({...QA,now:()=>now,
  maxRequestsPerMinute:4});
 for(const op of ['DRIVER_INBOX','DRIVER_HISTORY',
  'DRIVER_MARK_VISIBLE_ORDERED','CHAT_HISTORY']){
  assert.equal(gate.allowRequest({actorId:actor(1),operation:op}),true);
 }
 assert.equal(gate.allowRequest({actorId:actor(1),
  operation:'CHAT_MARK_VISIBLE_ORDERED'}),false);
 assert.equal(gate.allowRequest({userId:actor(2),operation:'CHAT_HISTORY'}),true);
 now+=60000;
 assert.equal(gate.allowRequest({actorId:actor(1),operation:'DRIVER_INBOX'}),true);
});
test('G58C denies forged actor and unauthorized operations fail closed without consuming valid budget',()=>{
 const gate=createG58CLocalChatRateGateQa({...QA,now:()=>200000,
  maxRequestsPerMinute:1});
 for(const req of [
  {actorId:'bad',operation:'DRIVER_INBOX'},
  {actorId:actor(1),userId:actor(2),operation:'DRIVER_INBOX'},
  {actorId:actor(1),operation:'CHAT_SEND'},
  {actorId:actor(1),operation:'ADMIN_MINT'},
  {actorId:actor(1),operation:'SQL_EXECUTE'},
  {actorId:actor(1),operation:'DRIVER_INBOX',sessionId:actor(2)},
  null,{}
 ]){
  assert.equal(gate.allowRequest(req),false,JSON.stringify(req));
 }
 assert.equal(gate.allowRequest({actorId:actor(1),operation:'DRIVER_INBOX'}),true);
 assert.equal(gate.allowRequest({actorId:actor(1),operation:'DRIVER_INBOX'}),false);
});
test('G58C monotonic clock and limited actor cardinality prevent memory growth',()=>{
 let now=200000;
 const gate=createG58CLocalChatRateGateQa({...QA,now:()=>now,
  maxRequestsPerMinute:2,maxTrackedActors:2});
 assert.equal(gate.allowRequest({actorId:actor(1),operation:'DRIVER_INBOX'}),true);
 assert.equal(gate.allowRequest({actorId:actor(2),operation:'DRIVER_INBOX'}),true);
 assert.equal(gate.allowRequest({actorId:actor(3),operation:'DRIVER_INBOX'}),false);
 now-=1000;
 assert.equal(gate.allowRequest({actorId:actor(1),operation:'DRIVER_INBOX'}),false);
 now+=62000;
 assert.equal(gate.allowRequest({actorId:actor(3),operation:'DRIVER_INBOX'}),true);
});
test('G58C refuses LIVE, unbounded limits and fabricated configuration',()=>{
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {maxRequestsPerMinute:0},{maxRequestsPerMinute:101},
  {maxTrackedActors:0},{maxTrackedActors:10001},{now:null}
 ])assert.throws(()=>createG58CLocalChatRateGateQa({...QA,...bad}));
});
