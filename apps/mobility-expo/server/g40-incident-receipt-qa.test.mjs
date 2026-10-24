import test from 'node:test';
import assert from 'node:assert/strict';
import {createG40IncidentReceiptQa} from './g40-incident-receipt-qa.mjs';

const time=Date.parse('2026-10-23T16:00:00Z');
const userId='11111111-1111-4111-8111-111111111111';
const subjectId='22222222-2222-4222-8222-222222222222';
const incidentId='33333333-3333-4333-8333-333333333333';
const receiptId='44444444-4444-4444-8444-444444444444';
const requestKey='55555555-5555-4555-8555-555555555555';
const bearer='verifiedSyntheticBearerWithSufficientLength123';
const fields={bearer,requestKey,subjectKind:'RIDE',subjectId,
 category:'SAFETY',severity:'HIGH'};
const dto={incidentId,receiptId,state:'open',revision:1,
 createdAt:'2026-10-23T15:59:00Z',observedAt:'2026-10-23T15:59:10Z',
 receiptStatus:'RECEIVED_IN_QA_DATABASE_ONLY'};
function gate(overrides={}){
 const calls=[];
 const api=createG40IncidentReceiptQa({
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  now:()=>time,verifyAccessToken:async()=>({
   id:userId,sessionId:'session-validated-01',expiresAtMs:time+90000
  }),
  verifySessionNotRevoked:async()=>true,allowRequest:()=>true,
  rpc:async(name,args)=>{calls.push({name,args});return {data:dto};},
  ...overrides
 });
 return {api,calls};
}
test('G40 returns durable typed receipt, never emergency acknowledgement',async()=>{
 const a=gate();
 const result=await a.api.report(fields);
 assert.deepEqual(result,{status:201,body:dto});
 assert.deepEqual(a.calls,[{name:'mobility_stage_g40_report_receipt',args:{
  _reporter:userId,_request_key:requestKey,_subject_kind:'RIDE',
  _subject_id:subjectId,_category:'SAFETY',_severity:'HIGH'
 }}]);
 assert.doesNotMatch(JSON.stringify(result),/911|emergency.dispatched|document|service_role|phone/);
});
test('G40 owner read requires JWT-bound reporter and emits only whitelisted DTO',async()=>{
 const a=gate();
 const out=await a.api.ownStatus({bearer,incidentId});
 assert.deepEqual(out,{status:200,body:dto});
 assert.deepEqual(a.calls[0],{name:'mobility_stage_g40_owner_incident_status',
  args:{_reporter:userId,_incident_id:incidentId}});
});
test('G40 blocks client-forged SOS, CRITICAL and malformed UUID before RPC',async()=>{
 const a=gate();
 for(const val of [
  {...fields,category:'SOS',severity:'CRITICAL'},
  {...fields,severity:'CRITICAL'},
  {...fields,subjectKind:'FANTASY'},
  {...fields,requestKey:'123'},
  {...fields,subjectId:'fake'}
 ]){
  assert.equal((await a.api.report(val)).status,400);
 }
 assert.equal(a.calls.length,0);
});
test('G40 revoke, cross-account and provider downtime fail closed',async()=>{
 for(const [change,status] of [
  [{verifyAccessToken:async()=>{throw Error('bad token')}},401],
  [{verifyAccessToken:async()=>({
   id:userId,sessionId:'session-validated-01',expiresAtMs:time-1
  })},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('down')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('down')}},503],
  [{rpc:async()=>{throw Error('db down')}},503]
 ]){
  const a=gate(change);
  assert.equal((await a.api.report(fields)).status,status);
 }
 const a=gate({rpc:async()=>({data:null})});
 assert.equal((await a.api.ownStatus({bearer,incidentId})).status,404);
});
test('G40 idempotency conflict maps 409 and malformed receipts never become sent',async()=>{
 for(const [rpc,status] of [
  [async()=>{const e=Error('conflict');e.code='G4009';throw e;},409],
  [async()=>({error:{code:'G4009'}}),409],
  [async()=>({data:{...dto,receiptStatus:'EMERGENCY_DISPATCHED'}}),503],
  [async()=>({data:{...dto,reporterEmail:'private'}}),503],
  [async()=>({data:{...dto,receiptId:'fake'}}),503],
  [async()=>({data:{...dto,revision:0}}),503]
 ]){
  assert.equal((await gate({rpc}).api.report(fields)).status,status);
 }
 const wrong=gate({rpc:async()=>({data:{...dto,incidentId:subjectId}})});
 assert.equal((await wrong.api.ownStatus({bearer,incidentId})).status,503);
});
test('G40 cannot create LIVE endpoint or operate without independent authorities',()=>{
 const def={environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
 verifyAccessToken:async()=>{},verifySessionNotRevoked:async()=>{},
 allowRequest:()=>true,rpc:async()=>{}};
 for(const change of [
  {liveEnabled:true},{localQaOnly:false},{environment:'production'},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {allowRequest:undefined},{rpc:null}
 ]){
  assert.throws(()=>createG40IncidentReceiptQa({...def,...change}),/required/);
 }
});
