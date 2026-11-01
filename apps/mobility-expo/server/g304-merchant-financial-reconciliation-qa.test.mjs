import test from 'node:test';
import assert from 'node:assert/strict';
import {
 G304_COMMERCE_PAYMENTS_LIVE,G304_COMMERCE_PAYOUTS_LIVE,
 G304_COD_LIVE,G304_CASH_CHECKOUT_ENABLED,COMMERCE_PAYMENT_METHODS,
 verifyCommerceCheckoutQA,prepareCommercePrepaidFulfillmentGateQA,
 prepareCommercePrepaidSplitQA,prepareCommerceCODReceivableQA,
 verifyCommerceCODRemittanceQA,validCommerceEntries
} from './g304-merchant-financial-reconciliation-qa.mjs';
const ids={
 order:'11111111-1111-4111-8111-111111111111',
 buyer:'22222222-2222-4222-8222-222222222222',
 merchant:'33333333-3333-4333-8333-333333333333',
 courier:'44444444-4444-4444-8444-444444444444'
};
const quote=()=>({
 orderId:ids.order,customerId:ids.buyer,merchantId:ids.merchant,
 catalogRevision:'CATALOG_VERSION_3',fareVersion:'DELIVERY_FARE_VERSION_3',
 merchandisePyg:100000,deliveryPyg:15000,totalPyg:115000,
 merchantCommissionBps:1000,deliveryCommissionBps:2000,
 merchantCommissionPyg:10000,deliveryCommissionPyg:3000,
 merchantNetPyg:90000,courierNetPyg:12000,platformCommissionPyg:13000,
 serverPersisted:true
});
const payment=()=>({orderId:ids.order,payerId:ids.buyer,method:'CARD',
 status:'CAPTURED',currency:'PYG',amountPyg:115000,
 provider:'STAGING_PSP_QA',pspPaymentRef:'psp-pay-0000001',
 pspEventRef:'psp-event-0000001',signedEventVerified:true,
 providerVerified:true,notRefunded:true});
const gate=()=>({
 quote:quote(),
 order:{orderId:ids.order,status:'AWAITING_PAYMENT',stockReserved:true,
 merchantApproved:true,verifiedByServer:true},
 payment:payment(),
 policy:{digitalOnly:true,approvedByOwner:true,ruleVersion:'OWNER_POLICY_V3'}
});
const delivery=()=>({orderId:ids.order,courierId:ids.courier,status:'DELIVERED',
 merchantPrepared:true,courierCompleted:true,
 buyerAcknowledged:true,verifiedByServer:true});
const split=()=>({quote:quote(),delivery:delivery(),dispute:false,
 processorFeePyg:1500,payment:{...payment(),status:'SETTLED'}});
const dispatch=prepareCommercePrepaidFulfillmentGateQA;
const settle=prepareCommercePrepaidSplitQA;
test('Commerce is STRICTLY prepaid and digital; no cash payment options',()=>{
 assert.equal(G304_COMMERCE_PAYMENTS_LIVE,false);
 assert.equal(G304_COMMERCE_PAYOUTS_LIVE,false);
 assert.equal(G304_COD_LIVE,false);
 assert.equal(G304_CASH_CHECKOUT_ENABLED,false);
 assert.deepEqual(COMMERCE_PAYMENT_METHODS,['CARD','BANK_TRANSFER','QR']);
 assert(!COMMERCE_PAYMENT_METHODS.includes('CASH'));
 assert.equal(prepareCommerceCODReceivableQA({}).code,'MERCHANT_CASH_PROHIBITED');
 assert.equal(verifyCommerceCODRemittanceQA({}).code,'MERCHANT_CASH_PROHIBITED');
});
test('Verified CARD CAPTURED allows merchant to prepare BEFORE delivery',()=>{
 const r=dispatch(gate());
 assert.equal(r.ok,true);assert.equal(r.merchantMayPrepare,true);
 assert.equal(r.goodsReleaseAllowed,true);assert.equal(r.payoutAllowed,false);
 assert.equal(r.processorFundsSettled,false);
 assert.equal(r.verifiedPrepaymentMethod,'CARD');
 assert.equal(r.idempotencyKey,'MERCHANT_PREPAY:'+ids.order);
});
test('No confirmed digital payment, NO merchant goods preparation or release',()=>{
 for(const change of [
  {status:'AUTHORIZED'},{status:'PENDING'}, {status:'FAILED'},
  {status:'REFUNDED'},{method:'CASH'},{method:'CASH_COURIER'},
  {signedEventVerified:false},{providerVerified:false},
  {notRefunded:false},{amountPyg:100000},{payerId:ids.courier},
  {currency:'USD'},{orderId:ids.buyer}
 ]){
  const x=gate();Object.assign(x.payment,change);
  const r=dispatch(x);assert.equal(r.code,'PREPAYMENT_NOT_VERIFIED');
  assert.equal(Object.hasOwn(r,'goodsReleaseAllowed'),false);
 }
});
test('QR and bank transfer require SETTLED, not a screenshot or pending payment',()=>{
 for(const method of ['QR','BANK_TRANSFER']){
  const x=gate();x.payment.method=method;
  assert.equal(dispatch(x).code,'PREPAYMENT_NOT_VERIFIED');
  x.payment.status='SETTLED';
  const r=dispatch(x);assert.equal(r.ok,true,method);
  assert.equal(r.processorFundsSettled,true);
 }
});
test('Cannot prepare or dispatch products without reserved stock/approved Merchant',()=>{
 for(const mut of [
  x=>x.order.stockReserved=false,
  x=>x.order.merchantApproved=false,
  x=>x.order.verifiedByServer=false,
  x=>x.order.status='IN_TRANSIT',
  x=>x.order.orderId=ids.buyer
 ]){
  const x=gate();mut(x);assert.equal(dispatch(x).code,'ORDER_OR_STOCK_NOT_ELIGIBLE');
 }
});
test('Owner-approved digital-only policy required on every commerce checkout',()=>{
 for(const mut of [
  x=>x.policy.digitalOnly=false,
  x=>x.policy.approvedByOwner=false,
  x=>x.policy.ruleVersion=''
 ]){
  const x=gate();mut(x);assert.equal(dispatch(x).code,'DIGITAL_ONLY_POLICY_REQUIRED');
 }
});
test('Frozen catalogue and fares cannot be changed by client or Driver',()=>{
 for(const mut of [
  x=>x.quote.serverPersisted=false,x=>x.quote.totalPyg=114999,
  x=>x.quote.catalogRevision='',x=>x.quote.merchantCommissionBps=2000,
  x=>x.quote.deliveryCommissionPyg=2000,
  x=>x.quote.merchantNetPyg=89999,
  x=>x.quote.courierNetPyg=11999,
  x=>x.quote.platformCommissionPyg=12500
 ]){
  const x=gate();mut(x);assert.equal(dispatch(x).code,'INVALID_FROZEN_COMMERCE_QUOTE');
 }
 assert.equal(verifyCommerceCheckoutQA(quote()),true);
});
test('Checkout works before courier assignment; only later delivery binds verified Courier',()=>{
 const q=quote();assert.equal(Object.hasOwn(q,'courierId'),false);
 assert.equal(dispatch(gate()).ok,true);
 const x=split();x.delivery.courierId=ids.buyer;
 assert.equal(settle(x).code,'ORDER_NOT_VERIFIED_DELIVERED');
});
test('100k goods + 15k delivery -> Merchant90 Courier12 QORE13',()=>{
 const x=settle(split());
 assert.equal(x.ok,true);assert.equal(x.paidByCustomerPyg,115000);
 assert.equal(x.merchantPayablePyg,90000);
 assert.equal(x.courierPayablePyg,12000);
 assert.equal(x.platformGrossPyg,13000);
 assert.equal(x.processorFeePyg,1500);assert.equal(x.platformNetPyg,11500);
 assert.equal(x.transfersSubmitted,false);assert.equal(x.payoutsConfirmed,false);
 assert.equal(validCommerceEntries(x.entries),true);
 assert.equal(x.entries.reduce((n,e)=>n+(e.side==='debit'?e.amountPyg:-e.amountPyg),0),0);
});
test('Captured but unsettled prepaid orders cannot pay Merchant or Courier',()=>{
 const x=split();x.payment.status='CAPTURED';
 assert.equal(dispatch({...gate(),payment:x.payment}).ok,true);
 assert.equal(settle(x).code,'SETTLED_PREPAYMENT_REQUIRED');
});
test('Prepaid payout waits for confirmed delivery and no disputes',()=>{
 for(const mut of [
  x=>x.delivery.status='PREPARING',
  x=>x.delivery.status='IN_TRANSIT',
  x=>x.delivery.merchantPrepared=false,
  x=>x.delivery.courierCompleted=false,
  x=>x.delivery.courierId=ids.merchant,
  x=>x.delivery.buyerAcknowledged=false,
  x=>x.delivery.verifiedByServer=false,
  x=>x.dispute=true
 ]){
  const x=split();mut(x);
  assert.equal(settle(x).code,'ORDER_NOT_VERIFIED_DELIVERED');
 }
});
test('Settlement rejects mismatched payer, unsigned callback and refunds',()=>{
 for(const change of [
  {payerId:ids.courier},{status:'REFUNDED'},
  {signedEventVerified:false},{providerVerified:false},{notRefunded:false},
  {pspPaymentRef:'bad'},{currency:'USD'},{amountPyg:114999},
  {method:'CASH'},{orderId:ids.buyer}
 ]){
  const x=split();Object.assign(x.payment,change);
  assert.equal(settle(x).code,'SETTLED_PREPAYMENT_REQUIRED');
 }
});
test('Processor fee cannot silently reduce Merchant or Courier amounts',()=>{
 for(const fee of [-1,13001,0.25,Infinity]){
  const x=split();x.processorFeePyg=fee;
  assert.equal(settle(x).code,'PSP_FEE_NOT_COVERED');
 }
 const x=split();x.processorFeePyg=13000;
 const s=settle(x);assert.equal(s.ok,true);
 assert.equal(s.merchantPayablePyg,90000);assert.equal(s.courierPayablePyg,12000);
 assert.equal(s.platformNetPyg,0);
});
test('Untrusted extra card, account or auth fields fail closed',()=>{
 const a=gate();a.payment.cardNumber='4111111111111111';
 assert.equal(dispatch(a).code,'PREPAYMENT_NOT_VERIFIED');
 const b=split();b.accessToken='unsafe';
 assert.equal(settle(b).code,'INVALID_SETTLEMENT_CONTRACT');
 const c=split();c.payment.accountNumber='123-456';
 assert.equal(settle(c).code,'SETTLED_PREPAYMENT_REQUIRED');
});
test('Recorded verification is deterministic; does NOT claim real payout',()=>{
 const g=dispatch(gate()),s=settle(split());
 assert.equal(g.idempotencyKey,'MERCHANT_PREPAY:'+ids.order);
 assert.equal(s.idempotencyKey,'MERCHANT_SETTLEMENT:'+ids.order);
 assert.equal(s.live,false);assert.equal(s.payoutsConfirmed,false);
 assert.equal(JSON.stringify(s).includes('psp-event-0000001'),false);
});
test('Accounting rejects fabricated columns and unbalanced ledger',()=>{
 const x=settle(split());const rows=x.entries.map(r=>({...r}));
 rows[1].amountPyg=89999;
 assert.equal(validCommerceEntries(rows),false);
 rows[1].amountPyg=90000;rows[1].cardToken='unsafe';
 assert.equal(validCommerceEntries(rows),false);
});
