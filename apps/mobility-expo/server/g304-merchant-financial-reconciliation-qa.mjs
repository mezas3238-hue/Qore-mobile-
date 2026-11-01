/**
 * G304 revised by Owner: ALL purchases of merchant goods PREPAID DIGITAL.
 * No cash checkout or cash-on-delivery, regardless of Driver or merchant.
 * QA-only, never an external PSP call or production financial transfer.
 */
export const G304_COMMERCE_PAYMENTS_LIVE=false;
export const G304_COMMERCE_PAYOUTS_LIVE=false;
export const G304_COD_LIVE=false;
export const G304_CASH_CHECKOUT_ENABLED=false;
export const COMMERCE_PAYMENT_METHODS=Object.freeze(['CARD','BANK_TRANSFER','QR']);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9._:-]{8,120}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(n,max=100000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const fail=code=>Object.freeze({ok:false,code,live:false});
const journal=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));
export function validCommerceEntries(entries){
 const accounts=[
  ['qa_psp_settlement_clearing','debit'],
  ['qa_merchant_payable','credit'],
  ['qa_courier_payable','credit'],
  ['qa_platform_commission_net','credit'],
  ['qa_psp_fee_payable','credit']
 ];
 if(!Array.isArray(entries)||entries.length!==accounts.length)return false;
 let debit=0,credit=0;
 for(let i=0;i<entries.length;i++){
  const item=entries[i];
  if(!exact(item,['account','side','amountPyg'])||
    item.account!==accounts[i][0]||item.side!==accounts[i][1]||
    !integer(item.amountPyg))return false;
  if(item.side==='debit')debit+=item.amountPyg;else credit+=item.amountPyg;
 }
 return Number.isSafeInteger(debit)&&Number.isSafeInteger(credit)&&debit>0&&debit===credit;
}
export function verifyCommerceCheckoutQA(quote){
 if(!exact(quote,['orderId','customerId','merchantId','courierId',
  'catalogRevision','fareVersion','merchandisePyg','deliveryPyg','totalPyg',
  'merchantCommissionBps','deliveryCommissionBps',
  'merchantCommissionPyg','deliveryCommissionPyg','merchantNetPyg',
  'courierNetPyg','platformCommissionPyg','serverPersisted']))return false;
 if(![quote.orderId,quote.customerId,quote.merchantId,quote.courierId]
  .every(v=>UUID.test(v??''))||
  new Set([quote.customerId,quote.merchantId,quote.courierId]).size!==3||
  !REF.test(quote.catalogRevision??'')||!REF.test(quote.fareVersion??'')||
  quote.serverPersisted!==true||
  !integer(quote.merchandisePyg)||quote.merchandisePyg===0||
  !integer(quote.deliveryPyg)||quote.deliveryPyg===0||
  !integer(quote.totalPyg)||quote.totalPyg===0||
  quote.merchandisePyg+quote.deliveryPyg!==quote.totalPyg||
  !integer(quote.merchantCommissionBps,3000)||
  !integer(quote.deliveryCommissionBps,3000)||
  !integer(quote.merchantCommissionPyg)||
  !integer(quote.deliveryCommissionPyg)||
  !integer(quote.merchantNetPyg)||!integer(quote.courierNetPyg)||
  !integer(quote.platformCommissionPyg))return false;
 return quote.merchantCommissionPyg===
   Math.floor((quote.merchandisePyg*quote.merchantCommissionBps+5000)/10000)&&
  quote.deliveryCommissionPyg===
   Math.floor((quote.deliveryPyg*quote.deliveryCommissionBps+5000)/10000)&&
  quote.merchantNetPyg===quote.merchandisePyg-quote.merchantCommissionPyg&&
  quote.courierNetPyg===quote.deliveryPyg-quote.deliveryCommissionPyg&&
  quote.platformCommissionPyg===quote.merchantCommissionPyg+
   quote.deliveryCommissionPyg&&
  quote.merchantNetPyg+quote.courierNetPyg+
   quote.platformCommissionPyg===quote.totalPyg;
}
/** No "cash" or pending bank transfer may release physical products.
 * A verified CARD CAPTURED is sufficient for preparation, NOT for payouts.
 * BANK_TRANSFER/QR require provider-confirmed SETTLED to release goods.
 */
function validPrepayment(quote,payment){
 return exact(payment,['orderId','payerId','method','status','currency','amountPyg',
  'provider','pspPaymentRef','pspEventRef','signedEventVerified',
  'providerVerified','notRefunded'])&&
  payment.orderId===quote.orderId&&payment.payerId===quote.customerId&&
  COMMERCE_PAYMENT_METHODS.includes(payment.method)&&
  (payment.method==='CARD'
   ?['CAPTURED','SETTLED'].includes(payment.status):payment.status==='SETTLED')&&
  payment.currency==='PYG'&&payment.amountPyg===quote.totalPyg&&
  REF.test(payment.provider??'')&&REF.test(payment.pspPaymentRef??'')&&
  REF.test(payment.pspEventRef??'')&&
  payment.signedEventVerified===true&&payment.providerVerified===true&&
  payment.notRefunded===true;
}
export function prepareCommercePrepaidFulfillmentGateQA(input){
 if(!exact(input,['quote','order','payment','policy']))
  return fail('INVALID_PREPAY_GATE_INPUT');
 const {quote,order,payment,policy}=input;
 if(!verifyCommerceCheckoutQA(quote))
  return fail('INVALID_FROZEN_COMMERCE_QUOTE');
 if(!exact(policy,['digitalOnly','approvedByOwner','ruleVersion'])||
   policy.digitalOnly!==true||policy.approvedByOwner!==true||
   !REF.test(policy.ruleVersion??''))
  return fail('DIGITAL_ONLY_POLICY_REQUIRED');
 if(!exact(order,['orderId','status','stockReserved',
   'merchantApproved','verifiedByServer'])||order.orderId!==quote.orderId||
   !['RESERVED','AWAITING_PAYMENT'].includes(order.status)||
   order.stockReserved!==true||order.merchantApproved!==true||
   order.verifiedByServer!==true)
  return fail('ORDER_OR_STOCK_NOT_ELIGIBLE');
 if(!validPrepayment(quote,payment))
  return fail('PREPAYMENT_NOT_VERIFIED');
 return Object.freeze({ok:true,mode:'PREPAID_DIGITAL_QA',
  live:false,orderId:quote.orderId,merchantId:quote.merchantId,
  verifiedPrepaymentMethod:payment.method,
  verifiedCaptureRef:payment.pspPaymentRef,
  idempotencyKey:'MERCHANT_PREPAY:'+quote.orderId,
  merchantMayPrepare:true,goodsReleaseAllowed:true,
  payoutAllowed:false,processorFundsSettled:payment.status==='SETTLED'});
}
function verifiedDelivery(quote,delivery){
 return exact(delivery,['orderId','status','merchantPrepared',
  'courierCompleted','buyerAcknowledged','verifiedByServer'])&&
  delivery.orderId===quote.orderId&&delivery.status==='DELIVERED'&&
  delivery.merchantPrepared===true&&delivery.courierCompleted===true&&
  delivery.buyerAcknowledged===true&&delivery.verifiedByServer===true;
}
/**
 * Final accounting after both fulfilled order and provider funds SETTLED.
 * Call prepayment gate before preparation/dispatch; this step follows delivery.
 */
export function prepareCommercePrepaidSplitQA(input){
 if(!exact(input,['quote','delivery','dispute','payment','processorFeePyg']))
  return fail('INVALID_SETTLEMENT_CONTRACT');
 const {quote,delivery,dispute,payment,processorFeePyg}=input;
 if(!verifyCommerceCheckoutQA(quote))
  return fail('INVALID_FROZEN_COMMERCE_QUOTE');
 if(dispute!==false||!verifiedDelivery(quote,delivery))
  return fail('ORDER_NOT_VERIFIED_DELIVERED');
 if(!validPrepayment(quote,payment)||payment.status!=='SETTLED')
  return fail('SETTLED_PREPAYMENT_REQUIRED');
 if(!integer(processorFeePyg)||processorFeePyg>quote.platformCommissionPyg)
  return fail('PSP_FEE_NOT_COVERED');
 const platformNetPyg=quote.platformCommissionPyg-processorFeePyg;
 const entries=journal([
  {account:'qa_psp_settlement_clearing',side:'debit',amountPyg:quote.totalPyg},
  {account:'qa_merchant_payable',side:'credit',amountPyg:quote.merchantNetPyg},
  {account:'qa_courier_payable',side:'credit',amountPyg:quote.courierNetPyg},
  {account:'qa_platform_commission_net',side:'credit',amountPyg:platformNetPyg},
  {account:'qa_psp_fee_payable',side:'credit',amountPyg:processorFeePyg}
 ]);
 if(!validCommerceEntries(entries))return fail('UNBALANCED_PREPAID_SPLIT');
 return Object.freeze({ok:true,mode:'PREPAID_RECONCILIATION_QA',
  live:false,orderId:quote.orderId,
  merchantId:quote.merchantId,courierId:quote.courierId,
  idempotencyKey:'MERCHANT_SETTLEMENT:'+quote.orderId,
  paidByCustomerPyg:quote.totalPyg,
  merchantPayablePyg:quote.merchantNetPyg,
  courierPayablePyg:quote.courierNetPyg,
  platformGrossPyg:quote.platformCommissionPyg,
  platformNetPyg,processorFeePyg,entries,
  transfersSubmitted:false,payoutsConfirmed:false});
}
// Rejection-by-design: CASH/COD are unsupported for *all* merchant orders.
export function prepareCommerceCODReceivableQA(){
 return fail('MERCHANT_CASH_PROHIBITED');
}
export function verifyCommerceCODRemittanceQA(){
 return fail('MERCHANT_CASH_PROHIBITED');
}
// Compatibility name used only in isolated QA: remains prepaid-only.
export const prepareCommerceCardSplitQA=prepareCommercePrepaidSplitQA;
