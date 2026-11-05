import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parseSupportActionIntent,parseSupportActionReceipt,SUPPORT_ACTION_KINDS
} from './support-action-contract.mjs';

const ticket='11111111-1111-4111-8111-111111111111';
const key='22222222-2222-4222-8222-222222222222';
const intent={ticket_id:ticket,expected_status:'OPEN',action:'ACKNOWLEDGE',idempotency_key:key};
const receipt={request_id:'33333333-3333-4333-8333-333333333333',
 ticket_id:ticket,action:'ACKNOWLEDGE',outcome:'QUEUED'};

test('G311 accepts only complete enumerated, PII-free ticket actions',()=>{
 assert.deepEqual(parseSupportActionIntent(intent),intent);
 assert.equal(Object.isFrozen(parseSupportActionIntent(intent)),true);
 for(const action of SUPPORT_ACTION_KINDS)assert.equal(
  parseSupportActionIntent({...intent,action})?.action,action);
});
test('G311 refuses client-supplied actor, address, phone, payout, notes, or arbitrary body',()=>{
 for(const field of ['actor_id','phone','full_name','message','notes','gps',
  'price','bank_account','service_role','endpoint','approveDriver']){
  assert.equal(parseSupportActionIntent({...intent,[field]:'unexpected'}),null,field);
 }
 for(const invalid of [
  {...intent,ticket_id:'fake'}, {...intent,idempotency_key:'1'},
  {...intent,expected_status:'RESOLVED'}, {...intent,action:'PAYOUT'},
  {...intent,action:'CLOSE_WITH_REFUND'}, {...intent,action:null},
  null,undefined,[],Object.assign(Object.create({unsafe:true}),intent)
 ])assert.equal(parseSupportActionIntent(invalid),null);
});
test('G311 receipts are strictly a QUEUED event, not proof of resolution',()=>{
 const parsed=parseSupportActionIntent(intent);
 assert.deepEqual(parseSupportActionReceipt(receipt,parsed),receipt);
 for(const invalid of [
  {...receipt,outcome:'RESOLVED'}, {...receipt,outcome:'PAID'},
  {...receipt,ticket_id:key}, {...receipt,action:'ESCALATE_FINANCE'},
  {...receipt,request_id:'oops'},
  {...receipt,customer_identity:'redacted'},null,[receipt]
 ])assert.equal(parseSupportActionReceipt(invalid,parsed),null);
});
