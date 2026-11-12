import test from 'node:test';
import assert from 'node:assert/strict';
import {CLIENT_COMMERCE_CASH_ENABLED,chooseClientPaymentOptions,
 validateClientPaymentChoice} from './g304-payment-choice-policy.mjs';
const cfg=(subjectKind='MERCHANT_ORDER')=>({
 subjectKind,fareMode:subjectKind==='MERCHANT_ORDER'?'MERCHANT_DELIVERY':
  subjectKind==='RIDE'?'AUTO':'DELIVERY',
 cardAvailable:true,cashAvailable:true,
 bankTransferAvailable:true,qrAvailable:true,
 commercePrepayBackendCertified:true
});
test('Commerce only digital, even when cash is enabled on platform',()=>{
 assert.equal(CLIENT_COMMERCE_CASH_ENABLED,false);
 const r=chooseClientPaymentOptions(cfg());
 assert.equal(r.ok,true);assert.deepEqual(r.options,['CARD','BANK_TRANSFER','QR']);
 assert.equal(r.cashAllowed,false);assert.equal(r.prepaidRequired,true);
 assert.equal(r.canSubmitOrderWithoutVerifiedPayment,false);
 assert.equal(validateClientPaymentChoice(cfg(),'CASH').code,'PAYMENT_METHOD_NOT_PERMITTED');
});
test('Every merchant checkout method fails closed until PSP prepay backend is certified',()=>{
 const c=cfg();c.commercePrepayBackendCertified=false;
 assert.equal(chooseClientPaymentOptions(c).code,'MERCHANT_PREPAYMENT_BACKEND_NOT_READY');
});
test('If no digital instrument is available, a merchant may NOT fall back to cash',()=>{
 const c=cfg();c.cardAvailable=false;c.bankTransferAvailable=false;c.qrAvailable=false;
 assert.equal(chooseClientPaymentOptions(c).code,'NO_PREPAY_METHOD_AVAILABLE');
});
test('RIDE AUTO/MOTO allow payment cash and card when available',()=>{
 for(const fareMode of ['AUTO','MOTO']){
  const c=cfg('RIDE');c.fareMode=fareMode;
  const r=chooseClientPaymentOptions(c);
  assert.deepEqual(r.options,['CASH','CARD']);
  assert.equal(r.prepaidRequired,false);
 }
});
test('Personal delivery allows both user-enabled methods',()=>{
 const c=cfg('DELIVERY');c.bankTransferAvailable=false;c.qrAvailable=false;
 assert.deepEqual(chooseClientPaymentOptions(c).options,['CASH','CARD']);
});
test('Wrong service and substituted mode cannot activate cash on commerce',()=>{
 for(const x of [
  {...cfg(),fareMode:'AUTO'},
  {...cfg(),subjectKind:'RIDE',fareMode:'MERCHANT_DELIVERY'},
  {...cfg(),subjectKind:'UNTRUSTED'}
 ])assert.equal(chooseClientPaymentOptions(x).code,'UNSUPPORTED_SERVICE');
});
test('Methods that are not truly available cannot be selected',()=>{
 const x=cfg();x.cardAvailable=false;
 assert.equal(validateClientPaymentChoice(x,'CARD').code,'PAYMENT_METHOD_NOT_PERMITTED');
 assert.equal(validateClientPaymentChoice(x,'BANK_TRANSFER').ok,true);
});
test('UI selection does NOT execute a purchase or authorize dispatch',()=>{
 const result=validateClientPaymentChoice(cfg(),'CARD');
 assert.equal(result.ok,true);assert.equal(result.prepaidRequired,true);
 assert.equal(result.requiresIndependentServerProof,true);
 assert.equal(result.paymentExecuted,false);assert.equal(result.orderReleased,false);
});
test('No unverified capability fields or unexpected server payload accepted',()=>{
 const x=cfg();x.injectedRole='owner';
 assert.equal(chooseClientPaymentOptions(x).code,'UNVERIFIED_PAYMENT_CAPABILITIES');
 const y=cfg();y.cardAvailable='true';
 assert.equal(chooseClientPaymentOptions(y).code,'UNVERIFIED_PAYMENT_CAPABILITIES');
});
