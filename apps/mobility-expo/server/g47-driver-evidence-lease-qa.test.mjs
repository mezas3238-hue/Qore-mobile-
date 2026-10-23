import test from 'node:test';
import assert from 'node:assert/strict';
import {createG47DriverEvidenceLeaseQa} from './g47-driver-evidence-lease-qa.mjs';
const id=n=>'47470000-0000-4747-8747-'+String(n).padStart(12,'0');
const driver=id(1),admin=id(2),sessionId=id(101);
const documentId=id(40),requestKey=id(201),leaseId=id(301);
const at=Date.parse('2026-10-23T20:00:00Z');
const bearer='g47-synthetic-pinned-jwt-long-token-no-real-credentials';
const docRequest={documentId,requestKey,purpose:'DRIVER_SELF_VIEW'};
const lease={leaseId,expiresAtMs:at+55000,accessMode:'QA_PRIVATE_METADATA_ONLY',
 signedUrlAvailable:false,storageConnected:false,
 documentBytesAvailable:false,productionEnabled:false};
const probe={leaseActive:true,signedUrlAvailable:false,
 documentBytesAvailable:false,productionEnabled:false};
const actor={id:driver,sessionId,tokenIatMs:at-15000,
 expiresAtMs:at+900000,is_anonymous:false,email_confirmed_at:'synthetic'};
function fx(options={}){
 const calls=[];
 const config={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',
  now:()=>at,verifyAccessToken:async()=>actor,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async user=>user===admin?'admin':'driver',
  verifyBackofficeMfa:async()=>({verifiedByProvider:true,userId:admin,sessionId,
   assuranceLevel:'aal2',verifiedAtMs:at-3000,expiresAtMs:at+120000}),
  allowRequest:()=>true,
  rpc:async(name,args)=>{
   calls.push({name,args});
   return {data:name==='mobility_stage_g47_issue_lease_qa'?lease:probe};
  },
  ...options
 };
 return {api:createG47DriverEvidenceLeaseQa(config),calls};
}
test('G47 issues 60s metadata-only opaque lease with the signed actor/session',async()=>{
 const t=fx();
 const out=await t.api.issue({bearer,body:docRequest});
 assert.equal(out.status,201,JSON.stringify(out.body));
 assert.deepEqual(out.body,lease);
 assert.deepEqual(t.calls[0],{name:'mobility_stage_g47_issue_lease_qa',
  args:{_actor:driver,_session:sessionId,_iat_ms:at-15000,
   _document:documentId,_request_key:requestKey,_purpose:'DRIVER_SELF_VIEW'}});
 assert.doesNotMatch(JSON.stringify(out),/objectKey|sha256|mimeType|bucket|https:|fileBytes/i);
});
test('G47 probed lease has no file access even when active in synthetic DB',async()=>{
 const t=fx();const r=await t.api.probe({bearer,
  body:{leaseId,purpose:'DRIVER_SELF_VIEW'}});
 assert.equal(r.status,200);
 assert.equal(r.body.leaseActive,true);
 assert.equal(r.body.signedUrlAvailable,false);
 assert.equal(r.body.documentBytesAvailable,false);
 assert.deepEqual(t.calls[0],{name:'mobility_stage_g47_probe_lease_qa',
  args:{_actor:driver,_session:sessionId,_iat_ms:at-15000,_lease:leaseId}});
});
test('G47 strict request seals prohibit driver IDs, path, URLs, bytes and forged reviewer flags',async()=>{
 const bad=[
  {...docRequest,driverId:driver},
  {...docRequest,objectKey:'driver/license.jpg'},
  {...docRequest,sha256Hex:'0'.repeat(64)},
  {...docRequest,signedUrl:'https://example.com'},
  {...docRequest,documentBytes:'abcdef'},
  {...docRequest,storageBucket:'live-bucket'},
  {...docRequest,reviewerApproved:true},
  {...docRequest,purpose:'ADMIN_APPROVE'},
  {...docRequest,documentId:'invalid'},
  {...docRequest,requestKey:'invalid'},
  {...docRequest,expiresAtMs:at+60000},
  null
 ];
 for(const body of bad){
  const t=fx();
  assert.equal((await t.api.issue({bearer,body})).status,400);
  assert.equal(t.calls.length,0);
 }
 for(const body of [
  {leaseId,purpose:'DRIVER_SELF_VIEW',actorId:driver},
  {leaseId:'invalid',purpose:'DRIVER_SELF_VIEW'},
  {leaseId,purpose:'ADMIN_APPROVE'},null
 ]){
  const t=fx();assert.equal((await t.api.probe({bearer,body})).status,400);
  assert.equal(t.calls.length,0);
 }
});
test('G47 independent Auth revocation and role gate always precede SQL',async()=>{
 for(const [override,status] of [
  [{verifyAccessToken:async()=>{throw Error('invalid')}} ,401],
  [{verifyAccessToken:async()=>({...actor,sessionId:'fake'})},401],
  [{verifyAccessToken:async()=>({...actor,tokenIatMs:at+1000})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('provider down')}},503],
  [{resolveExclusiveRole:async()=>['driver','passenger']},403],
  [{resolveExclusiveRole:async()=> 'passenger'},403],
  [{allowRequest:()=>false},429]
 ]){
  const t=fx(override);
  assert.equal((await t.api.issue({bearer,body:docRequest})).status,status);
  assert.equal(t.calls.length,0);
 }
});
test('G47 Admin cannot query pending evidence without independent fresh provider AAL2',async()=>{
 const adminActor={...actor,id:admin};
 for(const override of [
  {verifyBackofficeMfa:async()=>{throw Error('no MFA')}},
  {verifyBackofficeMfa:async()=>({verifiedByProvider:false})},
  {verifyBackofficeMfa:async()=>({verifiedByProvider:true,
   userId:admin,sessionId,assuranceLevel:'aal1',
   verifiedAtMs:at-1000,expiresAtMs:at+20000})},
  {verifyBackofficeMfa:async()=>({verifiedByProvider:true,
   userId:admin,sessionId,assuranceLevel:'aal2',
   verifiedAtMs:at-50000000,expiresAtMs:at+20000})},
  {verifyBackofficeMfa:async()=>({verifiedByProvider:true,
   userId:driver,sessionId,assuranceLevel:'aal2',
   verifiedAtMs:at-1000,expiresAtMs:at+20000})}
 ]){
  const t=fx({verifyAccessToken:async()=>adminActor,...override});
  const r=await t.api.issue({bearer,body:{...docRequest,purpose:'ADMIN_MANUAL_REVIEW'}});
  assert.equal(r.status,403);
  assert.equal(t.calls.length,0);
 }
 const positive=fx({verifyAccessToken:async()=>adminActor});
 const r=await positive.api.issue({bearer,body:{...docRequest,purpose:'ADMIN_MANUAL_REVIEW'}});
 assert.equal(r.status,201);
 assert.equal(positive.calls[0].args._actor,admin);
});
test('G47 rejects unsafe receipts even when SQL responded success',async()=>{
 for(const value of [
  {...lease,signedUrlAvailable:true},
  {...lease,storageConnected:true},
  {...lease,documentBytesAvailable:true},
  {...lease,productionEnabled:true},
  {...lease,expiresAtMs:at+61000},
  {...lease,expiresAtMs:at-1000},
  {...lease,objectKey:'secret'},
  {...lease,sha256Hex:'0'.repeat(64)},
  {...lease,leaseId:'bad-id'}
 ]){
  const t=fx({rpc:async()=>({data:value})});
  assert.equal((await t.api.issue({bearer,body:docRequest})).status,503);
 }
 for(const value of [{...probe,signedUrlAvailable:true},{...probe,documentBytesAvailable:true},
  {...probe,objectKey:'secret'},{...probe,productionEnabled:true}]){
  const t=fx({rpc:async()=>({data:value})});
  assert.equal((await t.api.probe({bearer,body:{leaseId,purpose:'DRIVER_SELF_VIEW'}})).status,503);
 }
});
test('G47 maps revoked leases and replay conflicts safely, fails closed on DB outage',async()=>{
 for(const [code,status] of [['G4701',403],['G4703',403],
  ['G4704',410],['G4709',409],['XX999',503]]){
  const t=fx({rpc:async()=>({error:{code}})});
  assert.equal((await t.api.issue({bearer,body:docRequest})).status,status);
 }
 const t=fx({rpc:async()=>{throw Error('backend Storage down')}});
 assert.equal((await t.api.issue({bearer,body:docRequest})).status,503);
 assert.equal((await t.api.probe({bearer,body:{leaseId,purpose:'DRIVER_SELF_VIEW'}})).status,503);
});
test('G47 never constructs production or unverified provider adapter',()=>{
 for(const options of [{environment:'production'},{liveEnabled:true},
  {localQaOnly:false},{verifyBackofficeMfa:null},
  {verifyAccessToken:null},{rpc:null}]){
  assert.throws(()=>fx(options));
 }
});
