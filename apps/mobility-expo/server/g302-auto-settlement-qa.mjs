/**
 * G302: deterministic split allocation and double-entry ledger, QA ONLY.
 * No bank transfer, PSP charge, payout or production side effect.
 * Inputs must originate from trusted server evidence in a future adapter.
 */
export const G302_LIVE_PAYMENTS_ENABLED=false;
export const G302_LIVE_PAYOUTS_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REFERENCE=/^[A-Za-z0-9._:-]{8,120}$/;
const SERVICE=new Set(['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']);
const METHODS=new Set(['CARD','WALLET','SPI']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const money=(n,max=100000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const deny=code=>Object.freeze({ok:false,code,livePaymentsEnabled:false,livePayoutsEnabled:false});
export function verifyAutomaticPayoutBalance(entries){
 const expected=[['qa_provider_funds_clearing','debit'],['qa_driver_payable','credit'],
  ['qa_platform_commission_net','credit'],['qa_processor_fee_payable','credit']];
 if(!Array.isArray(entries)||entries.length!==4)return false;
 let debit=0,credit=0;
 for(let i=0;i<4;i++){
  const e=entries[i];
  if(!exact(e,['account','side','amountPyg'])||e.account!==expected[i][0]||
    e.side!==expected[i][1]||!money(e.amountPyg))return false;
  if(e.side==='debit')debit+=e.amountPyg;else credit+=e.amountPyg;
 }
 return Number.isSafeInteger(debit)&&Number.isSafeInteger(credit)&&debit===credit&&debit>0;
}
export function prepareAutomaticPayoutLedgerQA(input){
 if(!exact(input,['serviceKind','bookingId','customerId','driverId','quote','payment',
  'completion','beneficiary','processorFeePyg','disputeHold']))
  return deny('INVALID_SETTLEMENT_CONTRACT');
 const {serviceKind,bookingId,customerId,driverId,quote,payment,completion,
  beneficiary,processorFeePyg,disputeHold}=input;
 if(!SERVICE.has(serviceKind)||!UUID.test(bookingId??'')||
  !UUID.test(customerId??'')||!UUID.test(driverId??'')||customerId===driverId)
  return deny('INVALID_ACTORS_OR_SERVICE');
 // Version-pinned quote comes from the server, never phone or invented rate.
 if(!exact(quote,['bookingId','serviceKind','totalPyg','subtotalPyg','tollsPyg',
  'commissionBps','commissionPyg','providerPyg','ruleVersion','serverPersisted'])||
  quote.bookingId!==bookingId||quote.serviceKind!==serviceKind||
  quote.serverPersisted!==true||!REFERENCE.test(quote.ruleVersion??'')||
  !money(quote.totalPyg)||quote.totalPyg===0||!money(quote.subtotalPyg)||
  !money(quote.tollsPyg,10000000)||!money(quote.commissionBps,3000)||
  !money(quote.commissionPyg)||!money(quote.providerPyg)||
  quote.subtotalPyg+quote.tollsPyg!==quote.totalPyg||
  Math.floor((quote.subtotalPyg*quote.commissionBps+5000)/10000)!==quote.commissionPyg||
  quote.providerPyg+quote.commissionPyg!==quote.totalPyg)
  return deny('SERVER_FARE_NOT_VERIFIED');
 if(disputeHold!==false)return deny('DISPUTE_OR_REFUND_HOLD');
 if(!exact(completion,['bookingId','serviceKind','status','verifiedByServer'])||
  completion.bookingId!==bookingId||completion.serviceKind!==serviceKind||
  completion.status!=='COMPLETED'||completion.verifiedByServer!==true)
  return deny('SERVICE_NOT_VERIFIED_COMPLETE');
 // Captured != settled. Await provider-origin signed proof and available funds.
 // These QA booleans MUST be replaced with verified provider data server-side.
 if(!exact(payment,['bookingId','payerId','status','method','currency',
  'amountPyg','provider','captureReference','webhookEventId',
  'verifiedByTrustedServer','fundsAvailable'])||
  payment.bookingId!==bookingId||payment.payerId!==customerId||
  payment.status!=='SETTLED'||!METHODS.has(payment.method)||
  payment.currency!=='PYG'||payment.amountPyg!==quote.totalPyg||
  !REFERENCE.test(payment.provider??'')||
  !REFERENCE.test(payment.captureReference??'')||
  !REFERENCE.test(payment.webhookEventId??'')||
  payment.verifiedByTrustedServer!==true||payment.fundsAvailable!==true)
  return deny('PROVIDER_FUNDS_NOT_CONFIRMED');
 if(!exact(beneficiary,['driverId','destinationReference','verifiedByServer',
  'payoutsApproved','documentClearanceApproved'])||
  beneficiary.driverId!==driverId||
  !REFERENCE.test(beneficiary.destinationReference??'')||
  beneficiary.verifiedByServer!==true||beneficiary.payoutsApproved!==true||
  beneficiary.documentClearanceApproved!==true)
  return deny('DRIVER_PAYOUT_ROUTE_NOT_VERIFIED');
 // Processor fees are transparent, deducted only from platform commission.
 if(!money(processorFeePyg)||processorFeePyg>quote.commissionPyg)
  return deny('PROCESSING_FEE_NOT_COVERED');
 const platformNetPyg=quote.commissionPyg-processorFeePyg;
 const entries=Object.freeze([
  {account:'qa_provider_funds_clearing',side:'debit',amountPyg:quote.totalPyg},
  {account:'qa_driver_payable',side:'credit',amountPyg:quote.providerPyg},
  {account:'qa_platform_commission_net',side:'credit',amountPyg:platformNetPyg},
  {account:'qa_processor_fee_payable',side:'credit',amountPyg:processorFeePyg}
 ].map(e=>Object.freeze(e)));
 if(!verifyAutomaticPayoutBalance(entries))return deny('UNBALANCED_LEDGER');
 // Future SQL: UNIQUE(serviceKind,bookingId), provider capture/event IDs.
 // Prepared allocation is NEVER proof of a bank payout or a PSP capture.
 return Object.freeze({ok:true,mode:'STAGING_DEMO_ONLY',
  livePaymentsEnabled:false,livePayoutsEnabled:false,
  payoutTransmitted:false,payoutConfirmed:false,
  serviceKind,bookingId,driverId,idempotencyKey:serviceKind+':'+bookingId,
  capturedPyg:quote.totalPyg,driverNetPyg:quote.providerPyg,
  commissionGrossPyg:quote.commissionPyg,processorFeePyg,
  platformRetainsNetPyg:platformNetPyg,
  paymentEvidenceReference:payment.captureReference,entries});
}
