import test from 'node:test';
import assert from 'node:assert/strict';
import {
 G304_COMMERCE_PAYMENTS_LIVE,G304_COMMERCE_PAYOUTS_LIVE,G304_COD_LIVE,
 verifyCommerceCheckoutQA,prepareCommerceCardSplitQA,prepareCommerceCODReceivableQA,
 verifyCommerceCODRemittanceQA,validCommerceEntries
} from './g304-merchant-financial-reconciliation-qa.mjs';
const ids={
 order:'11111111-1111-4111-8111-111111111111',
 buyer:'22222222-2222-4222-8222-222222222222',
 merchant:'33333333-3333-4333-8333-333333333333',
 courier:'44444444-4444-4444-8444-444444444444'
};
const quote=()=>({
 orderId:ids.order,customerId:ids.buyer,merchantId:ids.merchant,courierId:ids.courier,
 catalogRevision:'CATALOG_VERSION_3',fareVersion:'DELIVERY_FARE_VERSION_3',
 merchandisePyg:100000,deliveryPyg:15000,totalPyg:115000,
 merchantCommissionBps:1000,deliveryCommissionBps:2000,
 merchantCommissionPyg:10000,deliveryCommissionPyg:3000,
 merchantNetPyg:90000,courierNetPyg:12000,platformCommissionPyg:13000,
 serverPersisted:true
});
const delivery=()=>({orderId:ids.order,status:'DELIVERED',
 merchantPrepared:true,courierCompleted:true,buyerAcknowledged:true,verifiedByServer:true});
const card=()=>({quote:quote(),delivery:delivery(),dispute:false,
 processorFeePyg:1500,payment:{orderId:ids.order,payerId:ids.buyer,
 method:'CARD',status:'SETTLED',currency:'PYG',amountPyg:115000,
 pspPaymentRef:'psp-pay-0000001',pspEventRef:'psp-event-0000001',
 signedEventVerified:true,fundsAvailable:true}});
const cod=()=>({quote:quote(),delivery:delivery(),dispute:false,
 policy:{ownerApproved:true,merchantConsented:true,courierCODEligible:true,
 cashCODEnabled:true,maximumCashOrderPyg:150000,policyVersion:'OWNER_COD_POLICY_1'},
 cashReceipt:{orderId:ids.order,method:'CASH_COURIER',
 collectedPyg:115000,status:'CONFIRMED',buyerAcknowledged:true,
 courierAcknowledged:true,verifiedByServer:true,receiptRef:'cod-receipt-001'}});
const receipts=()=>{const allocation=prepareCommerceCODReceivableQA(cod());return{
 allocation,merchantReceipt:{orderId:ids.order,amountPyg:90000,
 bankOrCollectorRef:'merchant-settle-001',verifiedByProvider:true,status:'SETTLED'},
 platformReceipt:{orderId:ids.order,amountPyg:13000,
 bankOrCollectorRef:'platform-settle-001',verifiedByProvider:true,status:'SETTLED'}
};};
const c=prepareCommerceCardSplitQA,ca=prepareCommerceCODReceivableQA,co=verifyCommerceCODRemittanceQA;
test('G304 commercial ops and payouts all OFF by design',()=>{
 assert.equal(G304_COMMERCE_PAYMENTS_LIVE,false);
 assert.equal(G304_COMMERCE_PAYOUTS_LIVE,false);
 assert.equal(G304_COD_LIVE,false);
});
test('100k goods + 15k delivery splits Merchant90 Courier12 QORE13',()=>{
 assert.equal(verifyCommerceCheckoutQA(quote()),true);
 const p=c(card());
 assert.equal(p.ok,true);assert.equal(p.collectedPyg,115000);
 assert.equal(p.merchantPayablePyg,90000);
 assert.equal(p.courierPayablePyg,12000);
 assert.equal(p.platformGrossPyg,13000);
 assert.equal(p.platformNetPyg,11500);assert.equal(p.processorFeePyg,1500);
 assert.equal(p.transfersSubmitted,false);assert.equal(p.payoutsConfirmed,false);
 assert.equal(validCommerceEntries(p.entries),true);
 assert.equal(p.entries.reduce((sum,x)=>sum+(x.side==='debit'?x.amountPyg:-x.amountPyg),0),0);
});
test('No Owner rate, no valid source of price, or inconsistent payout => no split',()=>{
 for(const mutate of [
  x=>x.quote.serverPersisted=false,x=>x.quote.totalPyg=114999,
  x=>x.quote.catalogRevision='',x=>x.quote.merchantCommissionBps=2500,
  x=>x.quote.deliveryCommissionPyg=2000,x=>x.quote.merchantNetPyg=89999,
  x=>x.quote.courierNetPyg=11999,x=>x.quote.platformCommissionPyg=12500
 ]){
  const x=card();mutate(x);
  assert.equal(c(x).code,'INVALID_FROZEN_COMMERCE_QUOTE');
 }
});
test('Wrong ID, self-merchant and extra personal/card fields fail closed',()=>{
 const a=card();a.quote.merchantId=ids.courier;
 assert.equal(c(a).ok,false);
 const b=card();b.payment.cardNumber='4111111111111111';
 assert.equal(c(b).code,'CARD_SETTLEMENT_NOT_VERIFIED');
 const d=card();d.jwt='token';
 assert.equal(c(d).code,'INVALID_CARD_CONTRACT');
});
test('Not delivered, stock not prepared, no buyer ack or dispute block both rails',()=>{
 for(const mut of [
  x=>x.delivery.status='IN_TRANSIT',x=>x.delivery.merchantPrepared=false,
  x=>x.delivery.courierCompleted=false,x=>x.delivery.buyerAcknowledged=false,
  x=>x.delivery.verifiedByServer=false,x=>x.dispute=true
 ]){
  const a=card();mut(a);assert.equal(c(a).code,'ORDER_NOT_VERIFIED_DELIVERED');
  const b=cod();mut(b);assert.equal(ca(b).code,'ORDER_NOT_VERIFIED_DELIVERED');
 }
});
test('Card capture/authorization is not settled funds, signed PSP proof required',()=>{
 for(const changes of [
  {status:'CAPTURED'}, {status:'AUTHORIZED'},{status:'CHARGEBACK'},
  {fundsAvailable:false}, {signedEventVerified:false},
  {amountPyg:114999},{payerId:ids.courier},{currency:'USD'},{method:'CASH'}
 ]){
  const x=card();Object.assign(x.payment,changes);
  assert.equal(c(x).code,'CARD_SETTLEMENT_NOT_VERIFIED');
 }
});
test('Processor fee cannot silently reduce merchant or courier earnings',()=>{
 for(const fee of [-1,13001,0.1,Infinity]){
  const x=card();x.processorFeePyg=fee;
  assert.equal(c(x).code,'PSP_FEE_NOT_COVERED');
 }
 const x=card();x.processorFeePyg=13000;
 const p=c(x);assert.equal(p.ok,true);
 assert.equal(p.merchantPayablePyg,90000);assert.equal(p.courierPayablePyg,12000);
 assert.equal(p.platformNetPyg,0);
});
test('COD: cash actually held by Courier115, only courier net12, owes103',()=>{
 const p=ca(cod());assert.equal(p.ok,true);
 assert.equal(p.mode,'CASH_COD_UNREMITTED_QA');
 assert.equal(p.physicalCashHeldByCourierPyg,115000);
 assert.equal(p.courierEconomicNetPyg,12000);
 assert.equal(p.dueToMerchantPyg,90000);
 assert.equal(p.dueToPlatformPyg,13000);
 assert.equal(p.courierCustodialDebtPyg,103000);
 assert.equal(p.merchantPayoutReady,false);
 assert.equal(p.platformCashReceived,false);
 assert.equal(validCommerceEntries(p.entries),true);
});
test('COD requires Owner caps, merchant consent and eligible courier',()=>{
 for(const mutate of [
  x=>x.policy.ownerApproved=false,
  x=>x.policy.merchantConsented=false,
  x=>x.policy.courierCODEligible=false,
  x=>x.policy.cashCODEnabled=false,
  x=>x.policy.maximumCashOrderPyg=114999,
  x=>x.policy.maximumCashOrderPyg=0,
  x=>x.policy.policyVersion=''
 ]){
  const x=cod();mutate(x);
  assert.equal(ca(x).code,'COD_RISK_POLICY_DENIED');
 }
});
test('COD cannot create cash receivable when cash is partial/contested/unverified',()=>{
 for(const mutate of [
  x=>x.cashReceipt.collectedPyg=100000,
  x=>x.cashReceipt.buyerAcknowledged=false,
  x=>x.cashReceipt.courierAcknowledged=false,
  x=>x.cashReceipt.verifiedByServer=false,
  x=>x.cashReceipt.status='PENDING',
  x=>x.cashReceipt.method='CARD',
  x=>x.cashReceipt.receiptRef='missing'
 ]){
  const x=cod();mutate(x);
  assert.equal(ca(x).code,'CASH_CUSTODY_NOT_VERIFIED');
 }
});
test('Merchant and platform remittance only reconciles after two confirmed receipts',()=>{
 const r=co(receipts());
 assert.equal(r.ok,true);
 assert.equal(r.merchantReceivedPyg,90000);
 assert.equal(r.platformReceivedPyg,13000);
 assert.equal(r.courierRetainedPyg,12000);
 assert.equal(r.transfersSubmitted,false);
 assert.equal(JSON.stringify(r).includes('merchant-settle-001'),false);
});
test('Partial, unverified, duplicate or wrong recipient receipt never closes COD',()=>{
 for(const mutate of [
  x=>x.merchantReceipt.amountPyg=1000,
  x=>x.platformReceipt.amountPyg=12000,
  x=>x.merchantReceipt.status='PENDING',
  x=>x.platformReceipt.verifiedByProvider=false,
  x=>x.platformReceipt.bankOrCollectorRef=x.merchantReceipt.bankOrCollectorRef,
  x=>x.merchantReceipt.orderId=ids.buyer,
  x=>x.allocation.courierCustodialDebtPyg=90000
 ]){
  const x=receipts();mutate(x);
  assert.equal(co(x).ok,false);
 }
});
test('Untrusted custom journal with extra fields or impossible amounts rejected',()=>{
 const p=c(card());
 const copy=p.entries.map(x=>({...x}));
 copy[1].amountPyg=89999;assert.equal(validCommerceEntries(copy),false);
 copy[1].amountPyg=90000;copy[1].bankAccount='123';
 assert.equal(validCommerceEntries(copy),false);
});
