/**
 * G304 Commerce: Buyer -> Merchant + Courier + Movete Facil.
 * QA-only accounting. Never capture cards, hold custodial funds, debit a
 * Driver, mark bank payout successful, or execute a LIVE merchant order.
 */
export const G304_COMMERCE_PAYMENTS_LIVE=false;
export const G304_COMMERCE_PAYOUTS_LIVE=false;
export const G304_COD_LIVE=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9._:-]{8,120}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(n,max=100000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const fail=code=>Object.freeze({ok:false,code,live:false});
const journal=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));
export function validCommerceEntries(entries){
 if(!Array.isArray(entries)||entries.length<2||entries.length>6)return false;
 let debit=0,credit=0;
 for(const item of entries){
  if(!exact(item,['account','side','amountPyg'])||
    typeof item.account!=='string'||!/^qa_[a-z_]{4,50}$/.test(item.account)||
    !['debit','credit'].includes(item.side)||!integer(item.amountPyg))return false;
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
 if(![quote.orderId,quote.customerId,quote.merchantId,quote.courierId].every(v=>UUID.test(v??''))||
  new Set([quote.customerId,quote.merchantId,quote.courierId]).size!==3||
  !REF.test(quote.catalogRevision??'')||!REF.test(quote.fareVersion??'')||
  quote.serverPersisted!==true||
  !integer(quote.merchandisePyg)||quote.merchandisePyg===0||
  !integer(quote.deliveryPyg)||quote.deliveryPyg===0||
  !integer(quote.totalPyg)||quote.totalPyg===0||
  quote.merchandisePyg+quote.deliveryPyg!==quote.totalPyg||
  !integer(quote.merchantCommissionBps,3000)||!integer(quote.deliveryCommissionBps,3000)||
  !integer(quote.merchantCommissionPyg)||!integer(quote.deliveryCommissionPyg)||
  !integer(quote.merchantNetPyg)||!integer(quote.courierNetPyg)||
  !integer(quote.platformCommissionPyg))return false;
 return quote.merchantCommissionPyg===
  Math.floor((quote.merchandisePyg*quote.merchantCommissionBps+5000)/10000)&&
  quote.deliveryCommissionPyg===
  Math.floor((quote.deliveryPyg*quote.deliveryCommissionBps+5000)/10000)&&
  quote.merchantNetPyg===quote.merchandisePyg-quote.merchantCommissionPyg&&
  quote.courierNetPyg===quote.deliveryPyg-quote.deliveryCommissionPyg&&
  quote.platformCommissionPyg===quote.merchantCommissionPyg+quote.deliveryCommissionPyg&&
  quote.merchantNetPyg+quote.courierNetPyg+quote.platformCommissionPyg===quote.totalPyg;
}
function verifyDelivery(quote,delivery,dispute){
 if(dispute!==false)return false;
 return exact(delivery,['orderId','status','merchantPrepared','courierCompleted',
  'buyerAcknowledged','verifiedByServer'])&&
  delivery.orderId===quote.orderId&&delivery.status==='DELIVERED'&&
  delivery.merchantPrepared===true&&delivery.courierCompleted===true&&
  delivery.buyerAcknowledged===true&&delivery.verifiedByServer===true;
}
/**
 * Card: PSP verified settled funds, not simply "captured". Merchant and
 * Courier each have an earmarked payable. PSP fee charged to platform here.
 */
export function prepareCommerceCardSplitQA(input){
 if(!exact(input,['quote','delivery','dispute','payment','processorFeePyg']))
  return fail('INVALID_CARD_CONTRACT');
 const {quote,delivery,dispute,payment,processorFeePyg}=input;
 if(!verifyCommerceCheckoutQA(quote))return fail('INVALID_FROZEN_COMMERCE_QUOTE');
 if(!verifyDelivery(quote,delivery,dispute))return fail('ORDER_NOT_VERIFIED_DELIVERED');
 if(!exact(payment,['orderId','payerId','method','status','currency','amountPyg',
  'pspPaymentRef','pspEventRef','signedEventVerified','fundsAvailable'])||
  payment.orderId!==quote.orderId||payment.payerId!==quote.customerId||
  payment.method!=='CARD'||payment.status!=='SETTLED'||
  payment.currency!=='PYG'||payment.amountPyg!==quote.totalPyg||
  !REF.test(payment.pspPaymentRef??'')||!REF.test(payment.pspEventRef??'')||
  payment.signedEventVerified!==true||payment.fundsAvailable!==true)
  return fail('CARD_SETTLEMENT_NOT_VERIFIED');
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
 if(!validCommerceEntries(entries))return fail('UNBALANCED_CARD_SPLIT');
 return Object.freeze({ok:true,mode:'CARD_SETTLED_QA',live:false,
  orderId:quote.orderId,merchantId:quote.merchantId,courierId:quote.courierId,
  idempotencyKey:'CARD_MERCHANT:'+quote.orderId,
  collectedPyg:quote.totalPyg,merchantPayablePyg:quote.merchantNetPyg,
  courierPayablePyg:quote.courierNetPyg,
  platformGrossPyg:quote.platformCommissionPyg,
  processorFeePyg,platformNetPyg,entries,
  transfersSubmitted:false,payoutsConfirmed:false});
}
/**
 * Cash on delivery (COD): courier physically carries ALL cash, including
 * money belonging to merchant. Never display it as Courier earnings.
 * The QA receivable represents only money to be remitted (not Courier net).
 */
export function prepareCommerceCODReceivableQA(input){
 if(!exact(input,['quote','delivery','dispute','cashReceipt','policy']))
  return fail('INVALID_COD_CONTRACT');
 const {quote,delivery,dispute,cashReceipt,policy}=input;
 if(!verifyCommerceCheckoutQA(quote))return fail('INVALID_FROZEN_COMMERCE_QUOTE');
 if(!verifyDelivery(quote,delivery,dispute))return fail('ORDER_NOT_VERIFIED_DELIVERED');
 if(!exact(policy,['ownerApproved','merchantConsented','courierCODEligible',
   'cashCODEnabled','maximumCashOrderPyg','policyVersion'])||
   policy.ownerApproved!==true||policy.merchantConsented!==true||
   policy.courierCODEligible!==true||policy.cashCODEnabled!==true||
   !integer(policy.maximumCashOrderPyg)||policy.maximumCashOrderPyg===0||
   !REF.test(policy.policyVersion??'')||quote.totalPyg>policy.maximumCashOrderPyg)
  return fail('COD_RISK_POLICY_DENIED');
 if(!exact(cashReceipt,['orderId','method','collectedPyg','status',
   'buyerAcknowledged','courierAcknowledged','verifiedByServer','receiptRef'])||
   cashReceipt.orderId!==quote.orderId||cashReceipt.method!=='CASH_COURIER'||
   cashReceipt.status!=='CONFIRMED'||cashReceipt.collectedPyg!==quote.totalPyg||
   cashReceipt.buyerAcknowledged!==true||cashReceipt.courierAcknowledged!==true||
   cashReceipt.verifiedByServer!==true||!REF.test(cashReceipt.receiptRef??''))
  return fail('CASH_CUSTODY_NOT_VERIFIED');
 const dueFromCourierPyg=quote.merchantNetPyg+quote.platformCommissionPyg;
 if(dueFromCourierPyg+quote.courierNetPyg!==quote.totalPyg)
  return fail('UNBALANCED_CUSTODY');
 const entries=journal([
  {account:'qa_courier_cash_custody_receivable',side:'debit',amountPyg:dueFromCourierPyg},
  {account:'qa_merchant_pending_cash',side:'credit',amountPyg:quote.merchantNetPyg},
  {account:'qa_platform_cash_commission_due',side:'credit',amountPyg:quote.platformCommissionPyg}
 ]);
 if(!validCommerceEntries(entries))return fail('UNBALANCED_COD_ENTRIES');
 return Object.freeze({ok:true,mode:'CASH_COD_UNREMITTED_QA',live:false,
  orderId:quote.orderId,courierId:quote.courierId,merchantId:quote.merchantId,
  idempotencyKey:'CASH_COD:'+quote.orderId,
  physicalCashHeldByCourierPyg:quote.totalPyg,
  courierEconomicNetPyg:quote.courierNetPyg,
  dueToMerchantPyg:quote.merchantNetPyg,
  dueToPlatformPyg:quote.platformCommissionPyg,
  courierCustodialDebtPyg:dueFromCourierPyg,
  merchantPayoutReady:false,platformCashReceived:false,
  remittanceSettled:false,entries});
}
/** Both remittances must be independently verified before "settled".
 * Returns no bank details or raw provider webhook data.
 */
export function verifyCommerceCODRemittanceQA(input){
 if(!exact(input,['allocation','merchantReceipt','platformReceipt']))
  return fail('INVALID_REMITTANCE_CONTRACT');
 const {allocation,merchantReceipt,platformReceipt}=input;
 if(allocation?.ok!==true||allocation.mode!=='CASH_COD_UNREMITTED_QA'||
  allocation.remittanceSettled!==false||
  !UUID.test(allocation.orderId??'')||
  !integer(allocation.dueToMerchantPyg)||!integer(allocation.dueToPlatformPyg)||
  !integer(allocation.courierCustodialDebtPyg)||
  allocation.dueToMerchantPyg+allocation.dueToPlatformPyg!==
  allocation.courierCustodialDebtPyg)return fail('INVALID_UNREMITTED_ORDER');
 const verifyReceipt=(receipt,due)=>exact(receipt,
  ['orderId','amountPyg','bankOrCollectorRef','verifiedByProvider','status'])&&
  receipt.orderId===allocation.orderId&&receipt.amountPyg===due&&
  REF.test(receipt.bankOrCollectorRef??'')&&receipt.verifiedByProvider===true&&
  receipt.status==='SETTLED';
 if(!verifyReceipt(merchantReceipt,allocation.dueToMerchantPyg)||
    !verifyReceipt(platformReceipt,allocation.dueToPlatformPyg)||
    merchantReceipt.bankOrCollectorRef===platformReceipt.bankOrCollectorRef)
  return fail('REMITTANCE_PENDING_OR_INVALID');
 return Object.freeze({ok:true,mode:'COD_REMITTANCE_RECONCILED_QA',
  live:false,orderId:allocation.orderId,
  merchantReceivedPyg:allocation.dueToMerchantPyg,
  platformReceivedPyg:allocation.dueToPlatformPyg,
  courierRetainedPyg:allocation.courierEconomicNetPyg,
  proofValidOnlyInQA:true,transfersSubmitted:false});
}
