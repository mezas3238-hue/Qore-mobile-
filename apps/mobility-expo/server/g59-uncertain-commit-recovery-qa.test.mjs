import test from 'node:test';
import assert from 'node:assert/strict';
import {createG59UncertainCommitRecoveryQa} from './g59-uncertain-commit-recovery-qa.mjs';
const uuid=n=>'59590000-0000-4959-8959-'+String(n).padStart(12,'0');
const actor=uuid(1),session=uuid(101),service=uuid(201),conv=uuid(301),
 key=uuid(401),message=uuid(501);
const now=Date.parse('2026-10-24T13:30:00Z');
const jwt='g59-private-jwt-independent-fixture-only-000000000';
const req={bearer:jwt,serviceKind:'RIDE',serviceId:service,conversationId:conv,
 requestKey:key,body:'Estoy cerca de la entrada'};
const identity={id:actor,sessionId:session,tokenIatMs:now-30000,
 expiresAtMs:now+60000,is_anonymous:false};
const ack={conversationId:conv,serviceId:service,requestKey:key,messageId:message,
 senderRole:'passenger',body:req.body,createdAt:now-1000,revision:2,serverStored:true};
const committed=(overrides={})=>({
 state:'COMMITTED',serverStored:true,retrySafe:false,reconcileAgain:false,
 qaOnly:true,productionEnabled:false,latestRevision:2,
 historyRefreshRequired:false,ack:{...ack},...overrides});
const unknown={state:'NOT_YET_OBSERVED',serverStored:false,retrySafe:false,
 reconcileAgain:true,qaOnly:true,productionEnabled:false};
function fixture(extra={}){
 const calls=[];
 const cfg={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',
  allowRequest:()=>true,now:()=>now,
  reconcileOwnerOnly:async args=>{calls.push(args);return {data:committed()};},
  ...extra};
 return {gateway:createG59UncertainCommitRecoveryQa(cfg),calls};
}
test('G59 recovers original committed G53 ACK using independent session identity',async()=>{
 const f=fixture();
 const result=await f.gateway.handle(req);
 assert.equal(result.status,200);
 assert.deepEqual(result.body,{state:'COMMITTED',ack,latestRevision:2,
  historyRefreshRequired:false,qaOnly:true,productionEnabled:false,retrySafe:false});
 assert.deepEqual(f.calls,[{_kind:'RIDE',_service:service,_conversation:conv,
  _actor:actor,_session:session,_iat:identity.tokenIatMs,_request:key,_body:req.body}]);
 assert(Object.isFrozen(result.body.ack));
 assert(Object.isFrozen(f.calls[0]));
});
test('G59 keeps G53 original revision while requiring G52 refresh at latest revision',async()=>{
 const f=fixture({reconcileOwnerOnly:async()=>({data:committed({
  latestRevision:9,historyRefreshRequired:true})})});
 const out=await f.gateway.handle(req);
 assert.equal(out.status,200);
 assert.equal(out.body.ack.revision,2);
 assert.equal(out.body.latestRevision,9);
 assert.equal(out.body.historyRefreshRequired,true);
});
test('G59 missing receipt never signals not-sent or safe-to-retry mutation',async()=>{
 const f=fixture({reconcileOwnerOnly:async()=>({data:unknown})});
 const r=await f.gateway.handle(req);
 assert.equal(r.status,503);
 assert.equal(r.body.code,'OUTCOME_UNKNOWN_RECONCILE_AGAIN');
 assert.equal(r.body.retrySafe,false);
 assert.equal(f.calls.length,0);
});
test('G59 rejects forged principal/role/sender/iat, PII and invalid service before SQL',async()=>{
 const f=fixture();
 for(const bad of [
  {...req,actorId:actor},{...req,role:'passenger'},
  {...req,sessionId:session},{...req,tokenIatMs:1},
  {...req,senderRole:'passenger'}, {...req,retrySafe:true},
  {...req,body:'Nueva linea\nroja'}, {...req,body:'https://site.invalid'},
  {...req,body:'correo@example.org'}, {...req,body:'tel 0981 123 456'},
  {...req,body:'<h1>hola</h1'}, {...req,body:'a'.repeat(501)},
  {...req,serviceKind:'MOTO_RIDE'},{...req,conversationId:'bad'},
  {...req,serviceId:'bad'},{...req,requestKey:'bad'},{...req,bearer:'short'}
 ]){
  assert.equal((await f.gateway.handle(bad)).status,400,JSON.stringify(bad).slice(0,100));
 }
 assert.equal(f.calls.length,0);
});
test('G59 JWT verification, role, revocation, limiter and DB errors fail closed',async()=>{
 for(const [override,status] of [
  [{verifyAccessToken:async()=>{throw Error('bad JWT')}},401],
  [{verifyAccessToken:async()=>({...identity,id:'invalid'})},401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:now})},401],
  [{verifyAccessToken:async()=>({...identity,is_anonymous:true})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('network')}},503],
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=> ['passenger','driver']},403],
  [{resolveExclusiveRole:async()=>{throw Error('role')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('rate gate')}},503],
  [{reconcileOwnerOnly:async()=>{throw Error('sql timeout after COMMIT')}},503],
  [{now:(()=>{let n=0;return ()=>n++===0?now:now+61000;})()},401]
 ]){
  const f=fixture(override);
  assert.equal((await f.gateway.handle(req)).status,status);
  assert.equal(f.calls.length,0);
 }
});
test('G59 maps PostgreSQL scope/replay/conflict into no deceptive ACK',async()=>{
 for(const [code,status,expected] of [
  ['G5001',401,'SESSION_REVOKED'],
  ['G5903',403,'RECONCILIATION_SCOPE_DENIED'],
  ['G5003',403,'RECONCILIATION_SCOPE_DENIED'],
  ['G5904',409,'SERVICE_ASSIGNMENT_CHANGED'],
  ['G5004',409,'SERVICE_ASSIGNMENT_CHANGED'],
  ['G5909',409,'REQUEST_KEY_PAYLOAD_CONFLICT'],
  ['G5902',400,'INVALID_RECONCILIATION'],
  ['G5905',503,'RECONCILIATION_UNAVAILABLE']
 ]){
  const f=fixture({reconcileOwnerOnly:async()=>({error:{code}})});
  const r=await f.gateway.handle(req);
  assert.equal(r.status,status);
  assert.equal(r.body.code,expected);
  assert.equal(r.body.retrySafe,false);
 }
});
test('G59 rejects forged or impossible committed receipt rather than inventing serverStored',async()=>{
 for(const bad of [
  {latestRevision:1},
  {latestRevision:3,historyRefreshRequired:false},
  {latestRevision:2,historyRefreshRequired:true},
  {retrySafe:true},{serverStored:false},{productionEnabled:true},{qaOnly:false},
  {ack:{...ack,body:'different'}},
  {ack:{...ack,revision:3}},
  {ack:{...ack,requestKey:uuid(902)}},
  {ack:{...ack,serviceId:uuid(903)}},
  {ack:{...ack,createdAt:now+60000}},
  {ack:{...ack,messageId:'fake'}},
  {ack:{...ack,secret:'private'}},
  {extra:'unexpected'}
 ]){
  const f=fixture({reconcileOwnerOnly:async()=>({data:committed(bad)})});
  const r=await f.gateway.handle(req);
  assert.equal(r.status,503,JSON.stringify(bad));
  assert.equal(r.body.code,'UNTRUSTED_RECONCILIATION');
 }
 for(const poisoned of [
  {...unknown,retrySafe:true},{...unknown,serverStored:true},
  {...unknown,reconcileAgain:false},{...unknown,productionEnabled:true},
  {...unknown,metadata:'extra'}
 ]){
  const f=fixture({reconcileOwnerOnly:async()=>({data:poisoned})});
  assert.equal((await f.gateway.handle(req)).body.code,'UNTRUSTED_RECONCILIATION');
 }
});
test('G59 never initializes in live/remote mode or without required independent authorities',()=>{
 for(const extra of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},{reconcileOwnerOnly:null}
 ])assert.throws(()=>fixture(extra));
});
