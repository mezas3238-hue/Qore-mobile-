import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchantContactPreference} from './merchant-contact-preference.mjs';
import {createMerchantSupportGuide} from './merchant-support-guide.mjs';
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor={role:'passenger',subject:id(1),sessionRevision:4};
let clock=1800000000000;
const newContact=()=>createMerchantContactPreference({now:()=>clock});
function guide(category='MISSING_ITEM'){
 const g=createMerchantSupportGuide();
 g.update(actor,{orderId:id(2)});
 g.update(actor,{reason:category});
 g.update(actor,{severity:'LOW'});
 return g;
}
test('R42 defaults to no recipient, no consent and no network capability',()=>{
 const c=newContact(),g=guide(),snap=c.snapshot(g.review(actor),actor);
 assert.equal(snap.ok,true);
 assert.equal(snap.recipient,null);
 assert.equal(snap.consent,false);
 assert.deepEqual(snap.allowedRecipients,['MERCHANT','SUPPORT']);
 assert.equal(snap.sendEnabled,false);
 assert.equal(snap.channelAuthorized,false);
 assert.equal('send' in c,false);
 assert.equal('post' in c,false);
});
test('R42 requires explicit recipient and explicit consent before local review',()=>{
 const c=newContact(),g=guide(),reviewed=g.review(actor);
 assert.equal(c.review(reviewed,actor).code,'CONSENT_OR_RECIPIENT_REQUIRED');
 assert.equal(c.setConsent(reviewed,actor,true).code,'RECIPIENT_REQUIRED');
 assert.equal(c.choose(reviewed,actor,'MERCHANT').consent,false);
 assert.equal(c.review(reviewed,actor).ok,false);
 const approved=c.setConsent(reviewed,actor,true);
 assert.equal(approved.readyToReview,true);
 const result=c.review(reviewed,actor);
 assert.equal(result.ok,true);
 assert.equal(result.recipient,'MERCHANT');
 assert.equal(result.mode,'IN_APP_ONLY');
 for(const flag of ['ownershipVerified','channelAuthorized','contactAttempted',
  'caseCreated','merchantNotified','supportNotified','sendEnabled','messageStored',
  'serverConsentRecorded','submitted'])assert.equal(result[flag],false);
 assert.equal('message' in result,false);
 assert.equal('requestKey' in result,false);
});
test('R42 switching recipients resets consent; consent revocation works',()=>{
 const c=newContact(),g=guide(),r=g.review(actor);
 c.choose(r,actor,'MERCHANT');c.setConsent(r,actor,true);
 assert.equal(c.choose(r,actor,'SUPPORT').consent,false);
 assert.equal(c.setConsent(r,actor,true).consent,true);
 assert.equal(c.setConsent(r,actor,false).readyToReview,false);
});
test('R42 disputes and safety never route to unverified merchant',()=>{
 for(const reason of ['PRICE_DISPUTE','SAFETY_CONCERN']){
  const c=newContact(),r=guide(reason).review(actor);
  assert.deepEqual(c.snapshot(r,actor).allowedRecipients,['SUPPORT']);
  assert.equal(c.choose(r,actor,'MERCHANT').code,
   'MERCHANT_CONTACT_NOT_ALLOWED_FOR_CATEGORY');
  assert.equal(c.choose(r,actor,'SUPPORT').recipient,'SUPPORT');
  assert.equal(c.setConsent(r,actor,true).readyToReview,true);
  assert.equal(c.review(r,actor).supportNotified,false);
 }
});
test('R42 missing, damaged, wrong, delay permit merchant as local recipient only',()=>{
 for(const reason of ['MISSING_ITEM','WRONG_ITEM','DAMAGED_ITEM','LATE_DELIVERY']){
  const c=newContact(),r=guide(reason).review(actor);
  assert.equal(c.choose(r,actor,'MERCHANT').ok,true);
  c.setConsent(r,actor,true);
  assert.equal(c.review(r,actor).merchantNotified,false);
 }
});
test('R42 new account or rotated JWT purges all prior consent',()=>{
 const c=newContact(),g=guide(),r=g.review(actor);
 c.choose(r,actor,'SUPPORT');c.setConsent(r,actor,true);
 assert.equal(c.snapshot(r,{...actor,subject:id(9)}).recipient,null);
 assert.equal(c.snapshot(r,actor).consent,false);
 c.choose(r,actor,'MERCHANT');c.setConsent(r,actor,true);
 assert.equal(c.snapshot(r,{...actor,sessionRevision:5}).readyToReview,false);
 assert.equal(c.snapshot(r,actor).recipient,null);
});
test('R42 order, reason, severity changes invalidate consent',()=>{
 const c=newContact(),g=guide(),r=g.review(actor);
 const variants=[
  {...r,intent:{...r.intent,subjectId:id(3)}},
  {...r,intent:{...r.intent,category:'QUALITY'}},
  {...r,intent:{...r.intent,severity:'HIGH'}}
 ];
 for(const changed of variants){
  c.choose(r,actor,'SUPPORT');c.setConsent(r,actor,true);
  const next=c.snapshot(changed,actor);
  assert.equal(next.consent,false);
  assert.equal(next.recipient,null);
 }
});
test('R42 explicit clock-based TTL does not renew stale consent',()=>{
 clock=1800000000000;
 const c=newContact(),r=guide().review(actor);
 c.choose(r,actor,'SUPPORT');c.setConsent(r,actor,true);
 clock+=599999;
 assert.equal(c.snapshot(r,actor).consent,true);
 clock++;
 assert.equal(c.review(r,actor).code,'CONTACT_PREFERENCE_EXPIRED');
 assert.equal(c.snapshot(r,actor).consent,false);
});
test('R42 rejects fake receipt, owner, role and unattended ticket',()=>{
 const c=newContact(),r=guide().review(actor);
 const invalid=[
  {...r,ownershipVerified:true},{...r,submitted:true},
  {...r,merchantContacted:true},{...r,operatorNotified:true},
  {...r,sosDispatched:true},{...r,caseCreated:true},
  {...r,intent:{...r.intent,subjectKind:'DRIVER'}},
  {...r,intent:{...r.intent,subjectId:'not-uuid'}},null,{}
 ];
 for(const value of invalid)
  assert.equal(c.snapshot(value,actor).code,'MERCHANT_GUIDE_NOT_REVIEWED');
 for(const other of [null,{...actor,role:'driver'},
  {...actor,subject:'bad'}, {...actor,sessionRevision:-1}])
  assert.equal(c.snapshot(r,other).code,'AUTH_REQUIRED');
});
test('R42 denies unknown recipient, implicit consent and PII injection',()=>{
 clock=1800000000000;
 const c=newContact(),r=guide().review(actor);
 for(const recipient of ['WHATSAPP','DRIVER','PHONE','mailto:private@example.test',
   'MERCHANT_SUPPORT',{role:'merchant'},null]){
  assert.equal(c.choose(r,actor,recipient).code,'INVALID_RECIPIENT');
 }
 for(const consent of ['true',1,null,{}]){
  assert.equal(c.setConsent(r,actor,consent).code,'INVALID_CONSENT');
 }
});
test('R42 clear and dispose remove permission irreversibly',()=>{
 const c=newContact(),r=guide().review(actor);
 c.choose(r,actor,'SUPPORT');c.setConsent(r,actor,true);
 c.clear();assert.equal(c.snapshot(r,actor).recipient,null);
 c.dispose();
 assert.equal(c.snapshot(r,actor).code,'CONTACT_DRAFT_DISPOSED');
 assert.equal(c.choose(r,actor,'SUPPORT').code,'CONTACT_DRAFT_DISPOSED');
});
