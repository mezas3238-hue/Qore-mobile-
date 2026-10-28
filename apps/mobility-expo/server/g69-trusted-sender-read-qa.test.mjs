import test from 'node:test';
import assert from 'node:assert/strict';
import {createG69TrustedSenderReadQa,G69_PUBLIC_SENDER_EXCHANGE_ENABLED}
 from './g69-trusted-sender-read-qa.mjs';
const uuid=n=>'69010000-0000-4690-8690-'+String(n).padStart(12,'0');
const sender=uuid(1),session=uuid(2),delivery=uuid(3),proof=uuid(4),
 attacker=uuid(5);
const now=Date.parse('2026-10-24T17:00:00Z');
const access='synthetic-pinned-authority-passenger-token-000000';
const ownerDTO={mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:sender,
 state:'requested',revision:1,vehicleKind:'MOTO',
 assignmentPersisted:false,proofVerified:false,qaOnly:true,
 productionEnabled:false,liveDeliveriesEnabled:false};
function fixture(extra={}){
 const calls={claims:[],attest:[],exchange:[]};
 const common={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>now,
  verifyAccessToken:async x=>{calls.claims.push(x);return {
   id:sender,sessionId:session,tokenIatMs:now-1000,
   expiresAtMs:now+60000,is_anonymous:false};},
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',
  allowRequest:()=>true,
  issueOwnerAttestation:async q=>{calls.attest.push(q);return proof;},
  exchangeDelegatedProof:async p=>{calls.exchange.push(p);return ownerDTO;},
  ...extra};
 return {gateway:createG69TrustedSenderReadQa(common),calls};
}
const read=g=>g.read({accessToken:access,deliveryId:delivery});
test('G69 signed Passenger gets exact B R62 DTO, SQL caller only sees one-use private proof',async()=>{
 assert.equal(G69_PUBLIC_SENDER_EXCHANGE_ENABLED,false);
 const f=fixture();
 const result=await read(f.gateway);
 assert.deepEqual(result,{status:200,body:ownerDTO});
 assert.deepEqual(f.calls.claims,[access]);
 assert.deepEqual(f.calls.attest,[{senderId:sender,sessionId:session,
  tokenIatMs:now-1000,deliveryId:delivery}]);
 assert.deepEqual(f.calls.exchange,[proof]);
 const out=JSON.stringify(result);
 for(const forbidden of [access,proof,session,'courierId','proofRef','senderPhone'])
  assert.equal(out.includes(forbidden),false);
});
test('G69 wrong identity, role, revoked session and forged attestations cannot execute delegated SQL',async()=>{
 const badCases=[
  {verifyAccessToken:async()=>{throw Error('bad token')}},
  {verifyAccessToken:async()=>({id:attacker,sessionId:session,tokenIatMs:now+1,
   expiresAtMs:now+500,is_anonymous:false})},
  {verifyAccessToken:async()=>({id:sender,sessionId:session,tokenIatMs:now-1,
   expiresAtMs:now-1,is_anonymous:false})},
  {verifyAccessToken:async()=>({id:sender,sessionId:session,tokenIatMs:now-1,
   expiresAtMs:now+500,is_anonymous:true})},
  {verifySessionNotRevoked:async()=>false},
  {resolveExclusiveRole:async()=> 'driver'},
  {resolveExclusiveRole:async()=> ['driver','passenger']},
  {allowRequest:()=>false},
  {issueOwnerAttestation:async()=> 'forged'},
  {issueOwnerAttestation:async()=>{throw Error('no owner')}}
 ];
 for(const extra of badCases){
  const f=fixture(extra),r=await read(f.gateway);
  assert.notEqual(r.status,200,JSON.stringify(extra));
  assert.equal(f.calls.exchange.length,0);
 }
});
test('G69 unexpected SQL data, PII and unverified delivered status fail closed',async()=>{
 const bad=[
  {...ownerDTO,deliveryId:attacker},
  {...ownerDTO,ownerId:attacker},
  {...ownerDTO,state:'delivered',revision:4,
   assignmentPersisted:true,proofVerified:false},
  {...ownerDTO,qaOnly:false},
  {...ownerDTO,productionEnabled:true},
  {...ownerDTO,liveDeliveriesEnabled:true},
  {...ownerDTO,revision:-1},
  {...ownerDTO,proofRef:proof},
  {...ownerDTO,courierId:attacker},
  null
 ];
 for(const dto of bad){
  const f=fixture({exchangeDelegatedProof:async()=>dto});
  const res=await read(f.gateway);
  assert.equal(res.status,503);
  assert.equal(res.body.retrySafe,false);
 }
 const f=fixture({exchangeDelegatedProof:async()=>{throw Error('DB timeout after consume');}});
 assert.equal((await read(f.gateway)).body.retrySafe,false);
});
test('G69 absent controlled sources and unsafe environment refuse setup',()=>{
 for(const x of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},
  {issueOwnerAttestation:null},{exchangeDelegatedProof:null}
 ])assert.throws(()=>fixture(x));
});
