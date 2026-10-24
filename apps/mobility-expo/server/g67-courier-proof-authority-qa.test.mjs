import test from 'node:test';
import assert from 'node:assert/strict';
import {createG67SyntheticProofAuthority,G67_REAL_PROOF_STORAGE_ENABLED}
 from './g67-courier-proof-authority-qa.mjs';
const id=n=>'67670000-0000-4676-8676-'+String(n).padStart(12,'0');
const driver=id(1),delivery=id(2),session=id(3),proof=id(4);
const bearer='a-valid-verified-identity-bearer-token';
const now=Date.parse('2026-10-24T18:00:00Z');
function fixture(extra={}){
 const calls=[];
 const authority=createG67SyntheticProofAuthority({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>now,
  resolveServerSession:async token=>{
   assert.equal(token,bearer);
   return {id:driver,sessionId:session,tokenIatMs:now-1000,
    expiresAtMs:now+60000,is_anonymous:false,sessionActive:true};
  },
  resolveExclusiveRole:async()=> 'driver',
  readAttestedProof:async args=>{calls.push(args);return {
   deliveryId:delivery,courierId:driver,sessionId:session,proofRef:proof,
   status:'verified',expiresAtMs:now+60000};},
  ...extra
 });
 return {authority,calls};
}
test('G67 provides server-attested reference exclusively to current courier',async()=>{
 assert.equal(G67_REAL_PROOF_STORAGE_ENABLED,false);
 const f=fixture();
 const r=await f.authority.obtainVerifiedProof({
  accessToken:bearer,deliveryId:delivery,actorId:driver});
 assert.deepEqual(r,{deliveryId,actorId:driver,proofRef:proof,verifiedByServer:true});
 assert.deepEqual(f.calls,[{actorId:driver,deliveryId,sessionId:session,
  tokenIatMs:now-1000}]);
 assert(!JSON.stringify(r).includes(bearer));
 assert(!JSON.stringify(r).includes(session));
});
test('G67 stale, revoked, unrelated courier and forged registry proof all denied',async()=>{
 for(const bad of [
  {resolveServerSession:async()=>({id:driver,sessionId:session,
   tokenIatMs:now-1000,expiresAtMs:now-1,is_anonymous:false,sessionActive:true})},
  {resolveServerSession:async()=>({id:driver,sessionId:session,
   tokenIatMs:now-1000,expiresAtMs:now+60000,is_anonymous:false,sessionActive:false})},
  {resolveServerSession:async()=>({id:id(99),sessionId:session,
   tokenIatMs:now-1000,expiresAtMs:now+60000,is_anonymous:false,sessionActive:true})},
  {resolveExclusiveRole:async()=>['driver','passenger']},
  {resolveExclusiveRole:async()=> 'passenger'},
  {resolveExclusiveRole:async()=>{throw Error('not available')}},
  {readAttestedProof:async()=>null},
  {readAttestedProof:async()=>({deliveryId:delivery,courierId:id(88),
   sessionId:session,proofRef:proof,status:'verified',expiresAtMs:now+60000})},
  {readAttestedProof:async()=>({deliveryId:delivery,courierId:driver,
   sessionId:session,proofRef:proof,status:'revoked',expiresAtMs:now+60000})},
  {readAttestedProof:async()=>({deliveryId:delivery,courierId:driver,
   sessionId:session,proofRef:proof,status:'verified',expiresAtMs:now-1})},
  {readAttestedProof:async()=>({deliveryId:delivery,courierId:driver,
   sessionId:session,proofRef:proof,status:'verified',expiresAtMs:now+60000,
   senderPhone:'secret'})},
  {readAttestedProof:async()=>{throw Error('DB down')}}
 ]){
  const f=fixture(bad);
  await assert.rejects(()=>f.authority.obtainVerifiedProof({
   accessToken:bearer,deliveryId:delivery,actorId:driver}));
 }
});
test('G67 invalid mobile IDs, environment, live or callback absence fail closed',async()=>{
 const f=fixture();
 for(const q of [
  {accessToken:'short',deliveryId:delivery,actorId:driver},
  {accessToken:bearer,deliveryId:'bad',actorId:driver},
  {accessToken:bearer,deliveryId:delivery,actorId:id(99)}
 ])await assert.rejects(()=>f.authority.obtainVerifiedProof(q));
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {resolveServerSession:null},{resolveExclusiveRole:null},
  {readAttestedProof:null}
 ])assert.throws(()=>fixture(bad));
});
