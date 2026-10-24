import test from 'node:test';
import assert from 'node:assert/strict';
import {createG58EAuditedQaTicketIssuer} from './g58e-audited-qa-ticket-issuer.mjs';
const id=n=>'58585000-0000-4858-8858-'+String(n).padStart(12,'0');
const user=id(1),session=id(101),conversation=id(301),service=id(201),ticket=id(901);
const now=Date.parse('2026-10-24T12:00:00Z');
const QA={environment:'isolated_staging',localQaOnly:true,liveEnabled:false};
const base={actorId:user,sessionId:session,tokenIatMs:now-30000};
const data=o=>({operation:o,ticket,expiresAtMs:now+15000,
 productionEnabled:false,qaOnly:true});
function setup(overrides={}){
 let calls=0,checks=0;
 const cfg={...QA,now:()=>now,
  verifySessionNotRevoked:async()=>{checks++;return true;},
  resolveExclusiveRole:async()=> 'driver',
  issueSyntheticTicket:async s=>{calls++;return data(s.operation);},
  ...overrides};
 const issuer=createG58EAuditedQaTicketIssuer(cfg);
 return {issuer,get calls(){return calls;},get checks(){return checks;}};
}
test('G58E private synthetic issuer reattests session and exclusive role on both sides of mint',async()=>{
 const f=setup();
 const scopes=[
  {operation:'DRIVER_INBOX',...base},
  {operation:'DRIVER_HISTORY',...base,serviceKind:'RIDE',serviceId:service,
   conversationId:conversation},
  {operation:'DRIVER_MARK_VISIBLE',...base,conversationId:conversation}
 ];
 for(const s of scopes){
  const t=await f.issuer.mintOwnerTicket(s);
  assert.deepEqual(t,data(s.operation));
  assert.equal(Object.isFrozen(t),true);
 }
 assert.equal(f.calls,3);
 assert.equal(f.checks,6);
});
test('G58E passenger scope gets isolated passenger role and a G49 first-open capability',async()=>{
 const f=setup({resolveExclusiveRole:async()=> 'passenger'});
 for(const s of [
  {operation:'CHAT_OPEN',...base,serviceKind:'RIDE',serviceId:service,conversationId:null},
  {operation:'CHAT_HISTORY',...base,serviceKind:'RIDE',serviceId:service,conversationId:conversation},
  {operation:'CHAT_READ',...base,conversationId:conversation}
 ])assert.equal((await f.issuer.mintOwnerTicket(s)).operation,s.operation);
 assert.equal(f.calls,3);
});
test('G58E refuses forged actor/service/session and any owner mint exposed as operation',async()=>{
 const f=setup();
 const invalid=[
  {operation:'DRIVER_INBOX',...base,actorId:'bad'},
  {operation:'DRIVER_INBOX',...base,role:'admin'},
  {operation:'DRIVER_INBOX',...base,userId:id(5)},
  {operation:'DRIVER_INBOX',...base,tokenIatMs:now+30000},
  {operation:'DRIVER_INBOX',...base,tokenIatMs:0},
  {operation:'DRIVER_INBOX',...base,sessionId:'bad'},
  {operation:'DRIVER_HISTORY',...base,serviceKind:'RIDE',serviceId:service,conversationId:null},
  {operation:'DRIVER_HISTORY',...base,serviceKind:'CAR',serviceId:service,conversationId:conversation},
  {operation:'CHAT_OPEN',...base,serviceKind:'RIDE',serviceId:service,conversationId:conversation},
  {operation:'ADMIN_MINT',...base},
  {operation:'CHAT_READ',...base,conversationId:conversation,throughSeq:100},
  {operation:'CHAT_HISTORY',...base,serviceKind:'RIDE',serviceId:service,conversationId:conversation,sql:'SELECT 1'}
 ];
 for(const s of invalid)await assert.rejects(()=>f.issuer.mintOwnerTicket(s));
 assert.equal(f.calls,0);
});
test('G58E role mismatch and session revoked BEFORE mint yield no minted token',async()=>{
 for(const opts of [
  {verifySessionNotRevoked:async()=>false},
  {resolveExclusiveRole:async()=> 'passenger'},
  {resolveExclusiveRole:async()=> ['driver','passenger']}
 ]){
  const f=setup(opts);
  await assert.rejects(()=>f.issuer.mintOwnerTicket({
   operation:'DRIVER_INBOX',...base}));
  assert.equal(f.calls,0);
 }
});
test('G58E revocation or role change DURING mint suppresses issued ticket',async()=>{
 let current=true;
 const f=setup({
  verifySessionNotRevoked:async()=>current,
  issueSyntheticTicket:async s=>{current=false;return data(s.operation);}
 });
 await assert.rejects(()=>f.issuer.mintOwnerTicket({operation:'DRIVER_INBOX',...base}));
 assert.equal(current,false);
 let role='driver';
 const g=setup({
  resolveExclusiveRole:async()=>role,
  issueSyntheticTicket:async s=>{role='passenger';return data(s.operation);}
 });
 await assert.rejects(()=>g.issuer.mintOwnerTicket({operation:'DRIVER_INBOX',...base}));
});
test('G58E refuses foreign ticket, longer expiry or production capability after issuance',async()=>{
 for(const bad of [
  {ticket:id(1),operation:'DRIVER_HISTORY'},
  {expiresAtMs:now+30000},
  {productionEnabled:true},{qaOnly:false},{expiresAtMs:now-1},
  {actorId:user},{sql:'select secret'}
 ]){
  const f=setup({issueSyntheticTicket:async s=>({...data(s.operation),...bad})});
  await assert.rejects(()=>f.issuer.mintOwnerTicket({operation:'DRIVER_INBOX',...base}));
 }
});
test('G58E is not allowed in LIVE or without an external trusted provider',()=>{
 for(const p of [{environment:'production'},{liveEnabled:true},
  {localQaOnly:false},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{issueSyntheticTicket:null}]){
  assert.throws(()=>createG58EAuditedQaTicketIssuer({...QA,
   now:()=>now,verifySessionNotRevoked:async()=>true,
   resolveExclusiveRole:async()=> 'driver',
   issueSyntheticTicket:async()=>data('DRIVER_INBOX'),...p}));
 }
});
