import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSupportClaimIntent,parseSupportClaimReceipt} from './support-claim-contract.mjs';
const intent={ticket_id:'11111111-1111-4111-8111-111111111111',
 idempotency_key:'22222222-2222-4222-8222-222222222222'};
const receipt={claim_id:'33333333-3333-4333-8333-333333333333',
 ticket_id:intent.ticket_id,outcome:'CLAIMED'};
test('G320 only two UUIDs travel from browser to server',()=>{
 assert.deepEqual(parseSupportClaimIntent(intent),intent);
 assert(Object.isFrozen(parseSupportClaimIntent(intent)));
 for(const field of ['agent_id','session_id','amount','phone','summary','assigned_support_id','actor_id','status','action']){
  assert.equal(parseSupportClaimIntent({...intent,[field]:'forbidden'}),null,field);
 }
 for(const invalid of [null,[],{},Object.create({ticket_id:intent.ticket_id}),
  {...intent,ticket_id:'bad'},{...intent,idempotency_key:'42'}]){
  assert.equal(parseSupportClaimIntent(invalid),null);
 }
});
test('G320 receipt cannot imply a resolved or paid ticket',()=>{
 assert.deepEqual(parseSupportClaimReceipt(receipt,intent),receipt);
 for(const bad of [{...receipt,outcome:'RESOLVED'},
  {...receipt,outcome:'PAID'},{...receipt,claim_id:'bad'},
  {...receipt,ticket_id:intent.idempotency_key},{...receipt,customer:'PII'},null]){
  assert.equal(parseSupportClaimReceipt(bad,intent),null);
 }
});
