import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSupportCase,parseSupportCasePage,SUPPORT_PERMISSIONS} from './support-contract.mjs';
const valid={ticket_id:'11111111-1111-4111-8111-111111111111',case_code:'MF-2026-001',
 category:'VIAJE_AUTO',summary:'Consulta por demora de viaje',status:'OPEN',
 priority:'NORMAL',assigned_support_id:null,updated_at:'2026-11-01T12:00:00Z'};
test('Support projection permits only minimum ticket fields with strict category/status',()=>{
 assert.deepEqual(parseSupportCase(valid),valid);
 assert.equal(parseSupportCase({...valid,extraPhone:'0990000000'}),null);
 assert.equal(parseSupportCase({...valid,category:'DRIVER_DOCUMENTS'}),null);
 assert.equal(parseSupportCase({...valid,priority:'PAYMENT_APPROVED'}),null);
 assert.equal(parseSupportCase({...valid,assigned_support_id:'other-person'}),null);
 assert.equal(parseSupportCase({...valid,summary:'\u0000 hidden'}),null);
 assert.equal(parseSupportCase({...valid,updated_at:'invalid'}),null);
 assert.equal(parseSupportCase({...valid,case_code:'<script>'}),null);
});
test('No KYC, finance, Owner, SOS or LIVE permission; read-only is intentional',()=>{
 for(const p of ['approveDriver','readDriverKyc','readIdentityDocuments',
  'changeFares','changeCommissions','moveMoney','editPayouts','manageRoles',
  'changeSafetyEvidence','enableLiveOperations','seeRawLocations','writeReply',
  'closeCase','assignCase','escalateCase'])assert.equal(SUPPORT_PERMISSIONS[p],false,p);
 assert.equal(SUPPORT_PERMISSIONS.viewAssignedCases,true);
 assert.equal(SUPPORT_PERMISSIONS.viewUnassignedQueue,true);
});
test('Response must be a bounded page of exactly typed tickets, no extra data',()=>{
 assert.equal(parseSupportCasePage([valid]).length,1);
 assert.equal(parseSupportCasePage(Array.from({length:51},()=>valid)),null);
 assert.equal(parseSupportCasePage([valid,{...valid,paymentCard:'secret'}]),null);
 assert.equal(parseSupportCasePage({items:[valid]}),null);
});
