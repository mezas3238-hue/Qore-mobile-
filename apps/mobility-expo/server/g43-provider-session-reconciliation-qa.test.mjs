import test from 'node:test';
import assert from 'node:assert/strict';
import {createG43ProviderSessionReconcilerQa} from './g43-provider-session-reconciliation-qa.mjs';

const at=Date.parse('2026-10-23T17:30:00Z');
const userId='43430000-0000-4343-8343-000000000001';
const sessionId='43430000-0000-4343-8343-000000000101';
const request=Object.freeze({userId,sessionId});
const baseSession=()=>({
 userId,sessionId,revision:3,active:true,
 observedAtMs:at-500,providerConfirmedAtMs:at-60000,
 tokenAllowedFromMs:at-45000,expiresAtMs:at+600000,
 assuranceLevel:'aal1'
});
function fixture({
 user={id:userId,email_confirmed_at:'2026-10-23T16:00:00Z'},
 session=baseSession(),stored=2,write=async change=>({
  applied:true,revision:change.revision
 })
}={}){
 let writes=[];
 const reconcile=createG43ProviderSessionReconcilerQa({
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  now:()=>at,readProviderUser:async()=>user,
  readProviderSession:async()=>session,
  readStoredRevision:async()=>stored,
  writeVersionedObservation:async change=>{
   writes.push(change);return write(change);
  }
 });
 return {reconcile,writes};
}
test('G43 privately observes fresh active provider session but never authorizes operations',async()=>{
 const {reconcile,writes}=fixture();
 assert.deepEqual(await reconcile(request),{
  outcome:'QA_OBSERVATION_RECORDED_NOT_AUTHORIZED',
  status:'GRANT_QA_ONLY',revision:3
 });
 assert.equal(writes.length,1);
 assert.equal(writes[0].evidenceKind,'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
 assert.equal(writes[0].expectedPreviousRevision,2);
 assert.equal(writes[0].userId,userId);
 assert.equal(writes[0].sessionId,sessionId);
});
test('G43 writes revoked or expired observation without creating active grant',async()=>{
 for(const session of [
  {...baseSession(),active:false},
  {...baseSession(),expiresAtMs:at-1000}
 ]){
  const {reconcile,writes}=fixture({session});
  assert.equal((await reconcile(request)).status,'REVOKE_QA_ONLY');
  assert.equal(writes[0].status,'REVOKE_QA_ONLY');
 }
});
test('G43 rejects stale provider revisions without downgrade or write',async()=>{
 const {reconcile,writes}=fixture({stored:3});
 assert.deepEqual(await reconcile(request),{
  outcome:'QA_STALE_IGNORED',revision:3
 });
 assert.equal(writes.length,0);
});
test('G43 denies cross-actor, stale provider proof and unconfirmed identity',async()=>{
 const variants=[
  {session:{...baseSession(),userId:'43430000-0000-4343-8343-000000000002'}},
  {session:{...baseSession(),sessionId:'43430000-0000-4343-8343-000000000202'}},
  {session:{...baseSession(),observedAtMs:at-60000}},
  {session:{...baseSession(),providerConfirmedAtMs:at+1000}},
  {session:{...baseSession(),tokenAllowedFromMs:at-120000}},
  {user:{id:userId,is_anonymous:true}},
  {user:{id:'43430000-0000-4343-8343-000000000002',email_confirmed_at:'ok'}},
  {session:{...baseSession(),assuranceLevel:'aal2'}},
  {session:{...baseSession(),assuranceLevel:'aal2',mfaVerifiedAtMs:at-43200001}}
 ];
 for(const variant of variants){
  const {reconcile,writes}=fixture(variant);
  await assert.rejects(reconcile(request),/G43_PROVIDER_SESSION_UNVERIFIED/);
  assert.equal(writes.length,0);
 }
});
test('G43 has no fallback on provider outage, invalid DB revision or failed conditional write',async()=>{
 const x=fixture();const args={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  now:()=>at,readProviderUser:async()=>({id:userId,email_confirmed_at:'ok'}),
  readProviderSession:async()=>{throw Error('provider offline');},
  readStoredRevision:async()=>2,
  writeVersionedObservation:async()=>{throw Error('should not write');}
 };
 await assert.rejects(createG43ProviderSessionReconcilerQa(args)(request),/provider offline/);
 for(const opt of [{stored:-1},{write:async()=>({applied:false,revision:3})}]){
  const {reconcile}=fixture(opt);
  await assert.rejects(reconcile(request),/G43_PROVIDER_SESSION_UNVERIFIED/);
 }
 assert.equal(x.writes.length,0);
});
test('G43 cannot be enabled for LIVE or without separate private sources',()=>{
 assert.throws(()=>createG43ProviderSessionReconcilerQa({
  environment:'production',liveEnabled:true,localQaOnly:false
 }),/private QA provider/);
});
