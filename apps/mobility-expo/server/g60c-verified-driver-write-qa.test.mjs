import test from 'node:test';
import assert from 'node:assert/strict';
import {createG60CVerifiedDriverWriteQa} from './g60c-verified-driver-write-qa.mjs';
const uuid=n=>'60603000-0000-4060-8060-'+String(n).padStart(12,'0');
const who=uuid(1),session=uuid(2),service=uuid(3),conv=uuid(4),
 key=uuid(5),msg=uuid(6),proof=uuid(7);
const at=Date.parse('2026-10-24T10:30:00Z');
const jwt='g60c-independent-provider-synthetic-jwt-000000000';
const req={bearer:jwt,serviceKind:'RIDE',serviceId:service,
 conversationId:conv,requestKey:key,body:'Estoy por la esquina'};
const actor={id:who,sessionId:session,tokenIatMs:at-15000,
 expiresAtMs:at+60000,is_anonymous:false};
const ack={conversationId:conv,serviceId:service,requestKey:key,
 messageId:msg,senderRole:'driver',body:req.body,
 createdAt:at-1000,revision:2,serverStored:true};
const receipt={state:'COMMITTED',serverStored:true,retrySafe:false,
 reconcileAgain:false,productionEnabled:false,qaOnly:true,
 latestRevision:3,historyRefreshRequired:true,ack};
const unknown={state:'NOT_YET_OBSERVED',serverStored:false,
 retrySafe:false,reconcileAgain:true,productionEnabled:false,qaOnly:true};
function fx(other={}){
 const calls={verified:[],seeded:[],sql:[],limit:[]};
 const opts={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
 now:()=>at,
 verifyAccessToken:async token=>{calls.verified.push(token);return actor;},
 verifySessionNotRevoked:async()=>true,
 resolveExclusiveRole:async()=> 'driver',
 allowRequest:scope=>{calls.limit.push(scope);return true;},
 createSyntheticAttestation:async scope=>{
  calls.seeded.push(scope);
  return {proof,expiresAtMs:at+10000,qaOnly:true,productionEnabled:false};},
 exchangeScopedProof:async ticket=>{calls.sql.push(ticket);return {data:ack};},
 ...other};
 return {gw:createG60CVerifiedDriverWriteQa(opts),calls};
}
test('G60C verified Auth and independent SQL proof, no client actor/iat',async()=>{
 const x=fx();
 const r=await x.gw.send(req);
 assert.equal(r.status,200);
 assert.deepEqual(r.body,ack);
 assert.deepEqual(x.calls.verified,[jwt]);
 assert.deepEqual(x.calls.seeded,[{operation:'DRIVER_SEND',driverId:who,
  sessionId:session,tokenIatMs:actor.tokenIatMs,serviceKind:'RIDE',
  serviceId:service,conversationId:conv,requestKey:key,body:req.body}]);
 assert.deepEqual(x.calls.sql,[proof]);
 assert.deepEqual(x.calls.limit,[{actorId:who,operation:'DRIVER_SEND'}]);
 assert(!JSON.stringify(r).includes(jwt));
 assert(!JSON.stringify(r).includes(session));
});
test('G60C verified Driver reconciliation preserves historical ACK and latest rev',async()=>{
 const x=fx({exchangeScopedProof:async()=>({data:receipt})});
 const r=await x.gw.reconcile(req);
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{state:'COMMITTED',ack,latestRevision:3,
  historyRefreshRequired:true,qaOnly:true,productionEnabled:false,retrySafe:false});
 assert.equal(r.body.ack.revision,2);
});
test('G60C missing row is 503 UNKNOWN not rollback or permission to resend',async()=>{
 const x=fx({exchangeScopedProof:async()=>({data:unknown})});
 const r=await x.gw.reconcile(req);
 assert.equal(r.status,503);
 assert.equal(r.body.code,'G60C_OUTCOME_UNKNOWN_RECONCILE_AGAIN');
 assert.equal(r.body.retrySafe,false);
});
test('G60C reject attempts to forge identity, role, request body, service',async()=>{
 const x=fx();
 for(const bad of [
  {...req,actorId:who},{...req,role:'driver'},
  {...req,sessionId:session},{...req,tokenIatMs:at},
  {...req,driverId:who},{...req,sql:'owner'},
  {...req,requestKey:'not-a-uuid'},
  {...req,serviceId:'bad'},{...req,conversationId:'bad'},
  {...req,serviceKind:'MOTO_RIDE'},
  {...req,body:'<b>bad</b>'},{...req,body:'email@test.org'},
  {...req,body:'https://example.com'},
  {...req,body:'numero 0981 123 456'},
  {...req,body:' hola '},{...req,body:'a'.repeat(501)},
  {...req,bearer:'short'}
 ])assert.equal((await x.gw.send(bad)).status,400);
 assert.equal(x.calls.seeded.length,0);
});
test('G60C pinned auth, session, exclusive Driver role and limiter fail closed',async()=>{
 for(const [changes,expected] of [
  [{verifyAccessToken:async()=>{throw Error('invalid')}} ,401],
  [{verifyAccessToken:async()=>({...actor,id:'bad'})},401],
  [{verifyAccessToken:async()=>({...actor,expiresAtMs:at})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('provider offline')}},503],
  [{resolveExclusiveRole:async()=> 'passenger'},403],
  [{resolveExclusiveRole:async()=> ['driver','passenger']},403],
  [{resolveExclusiveRole:async()=>{throw Error('missing')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('limiter unavailable')}},503],
  [{createSyntheticAttestation:async()=>{throw Error('owner unavailable')}},503],
  [{createSyntheticAttestation:async()=>({proof,expiresAtMs:at+20000,
   qaOnly:true,productionEnabled:false})},503],
  [{exchangeScopedProof:async()=>{throw Error('after commit network timeout')}},503]
 ]){
  const r=await fx(changes).gw.send(req);
  assert.equal(r.status,expected,JSON.stringify(changes));
  assert.equal(r.body.retrySafe,false);
 }
});
test('G60C rejects poisoned SQL persisted ACK and forged G59B reconciliation',async()=>{
 for(const invalid of [
  {...ack,requestKey:uuid(88)}, {...ack,body:'different'},
  {...ack,senderRole:'passenger'},{...ack,serverStored:false},
  {...ack,messageId:'bad'},{...ack,createdAt:at+100},
  {...ack,revision:1},{...ack,secret:'private'}
 ]){
  const g=fx({exchangeScopedProof:async()=>({data:invalid})}).gw;
  assert.equal((await g.send(req)).status,503);
 }
 for(const invalid of [
  {...receipt,ack:{...ack,body:'other'}},
  {...receipt,latestRevision:1},
  {...receipt,historyRefreshRequired:false},
  {...receipt,qaOnly:false},{...receipt,retrySafe:true},
  {...receipt,trace:'secret'}
 ]){
  const g=fx({exchangeScopedProof:async()=>({data:invalid})}).gw;
  assert.equal((await g.reconcile(req)).status,503);
 }
});
test('G60C SQL role, expired token and random proof errors never leak sensitive data',async()=>{
 for(const [code,status] of [
  ['G6013',401],['G5603',403],['G5604',409],
  ['G5919',409],['G6012',503],['G6014',503],
  ['G5002',400]
 ]){
  const g=fx({exchangeScopedProof:async()=>({error:{code}})}).gw;
  const r=await g.send(req);
  assert.equal(r.status,status);
  assert(!JSON.stringify(r).includes(jwt));
 }
 const x=fx({now:(()=>{let n=0;return ()=>++n===1?at:at+61000;})()});
 assert.equal((await x.gw.send(req)).status,503);
});
test('G60C no production, unverified startup or missing scope authority',()=>{
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},
  {createSyntheticAttestation:null},{exchangeScopedProof:null},{now:null}
 ])assert.throws(()=>fx(bad));
});
