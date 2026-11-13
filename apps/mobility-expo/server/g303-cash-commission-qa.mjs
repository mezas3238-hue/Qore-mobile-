/**
 * G303 -- CASH TRIPS (STAGING QA ONLY). No cash actually reaches QORE:
 * driver keeps the notes, and the frozen Owner commission is a receivable.
 * NO bank transfers, auto-debits, negative Driver payouts or LIVE trips.
 *
 * A real writer must verify the 2-party payment receipt, persist the
 * quote version, lock a UNIQUE(booking,service) and post exactly once.
 */
export const CASH_LIVE_OPERATIONS_ENABLED=false;
export const CASH_AUTO_COLLECTION_ENABLED=false;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const REF=/^[A-Za-z0-9._:-]{8,120}$/;
const SERVICES=new Set(['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const pyg=(n,top=100000000)=>Number.isSafeInteger(n)&&n>=0&&n<=top;
const denied=(code)=>Object.freeze({ok:false,code,liveOperationsEnabled:false});
const immutableEntries=(rows)=>Object.freeze(rows.map(row=>Object.freeze(row)));
export function prepareCashCommissionQA(input){
 const fields=['serviceKind','bookingId','customerId','driverId','fare','completion',
  'collection','disputed','ownerCommissionPolicyApproved'];
 if(!exact(input,fields))return denied('INVALID_CASH_INPUT');
 const {serviceKind,bookingId,customerId,driverId,fare,completion,
  collection,disputed,ownerCommissionPolicyApproved}=input;
 if(!SERVICES.has(serviceKind)||!UUID.test(bookingId??'')||
  !UUID.test(customerId??'')||!UUID.test(driverId??'')||customerId===driverId)
  return denied('INVALID_BOOKING_IDENTITIES');
 if(ownerCommissionPolicyApproved!==true)return denied('OWNER_COMMISSION_NOT_VERIFIED');
 if(!exact(fare,['bookingId','serviceKind','subtotalPyg','tollsPyg','totalPyg',
  'commissionBps','commissionPyg','driverNetPyg','ruleVersion','persistedByServer'])||
  fare.bookingId!==bookingId||fare.serviceKind!==serviceKind||
  !pyg(fare.subtotalPyg)||!pyg(fare.tollsPyg,10000000)||
  !pyg(fare.totalPyg)||fare.totalPyg===0||
  !pyg(fare.commissionBps,3000)||!pyg(fare.commissionPyg)||
  !pyg(fare.driverNetPyg)||!REF.test(fare.ruleVersion??'')||
  fare.persistedByServer!==true||fare.subtotalPyg+fare.tollsPyg!==fare.totalPyg||
  fare.commissionPyg!==Math.floor((fare.subtotalPyg*fare.commissionBps+5000)/10000)||
  fare.driverNetPyg+fare.commissionPyg!==fare.totalPyg)
  return denied('UNVERIFIED_FROZEN_OWNER_FARE');
 if(!exact(completion,['bookingId','status','verifiedByServer'])||
  completion.bookingId!==bookingId||completion.status!=='COMPLETED'||
  completion.verifiedByServer!==true)return denied('TRIP_NOT_COMPLETED');
 if(disputed!==false)return denied('CASH_DISPUTED_HOLD');
 if(!exact(collection,['bookingId','method','actualCollectedPyg',
  'status','acknowledgement','verifiedByServer','receiptRef'])||
  collection.bookingId!==bookingId||collection.method!=='CASH'||
  collection.status!=='CONFIRMED'||collection.verifiedByServer!==true||
  !['TWO_PARTY_CONFIRMED','INDEPENDENTLY_ADJUDICATED'].includes(collection.acknowledgement)||
  !REF.test(collection.receiptRef??'')||!pyg(collection.actualCollectedPyg)||
  collection.actualCollectedPyg!==fare.totalPyg)
  return denied('CASH_NOT_VERIFIED_FULLY_PAID');
 // Physically held cash is NOT platform revenue or a platform cash asset.
 const journal=immutableEntries([
  {account:'qa_commission_due_from_driver',side:'debit',amountPyg:fare.commissionPyg},
  {account:'qa_platform_commission_earned',side:'credit',amountPyg:fare.commissionPyg}
 ]);
 return Object.freeze({ok:true,mode:'STAGING_DEMO_ONLY',liveOperationsEnabled:false,
  platformReceivedCashPyg:0,driverHoldsPhysicalCashPyg:fare.totalPyg,
  driverEconomicNetPyg:fare.driverNetPyg,commissionReceivablePyg:fare.commissionPyg,
  settlementState:'COMMISSION_PENDING_QA',serviceKind,bookingId,driverId,
  idempotencyKey:serviceKind+':'+bookingId,
  ownerFareRuleVersion:fare.ruleVersion,journal});
}
export function prepareCashDebtOffsetQA(input){
 const keys=['driverId','receivable','digitalEarnings','policy'];
 if(!exact(input,keys)||!UUID.test(input.driverId??''))
  return denied('INVALID_OFFSET_INPUT');
 const {driverId,receivable,digitalEarnings,policy}=input;
 if(!exact(policy,['allowAutomaticOffset','approvedByOwner','version','maxOffsetBps','minimumDriverPayoutPyg'])||
  policy.allowAutomaticOffset!==true||policy.approvedByOwner!==true||
  !REF.test(policy.version??'')||!pyg(policy.maxOffsetBps,10000)||
  !pyg(policy.minimumDriverPayoutPyg))return denied('OFFSET_POLICY_NOT_APPROVED');
 if(!exact(receivable,['driverId','outstandingPyg','ledgerVersion','verifiedByServer','onHold'])||
  receivable.driverId!==driverId||!pyg(receivable.outstandingPyg)||
  !REF.test(receivable.ledgerVersion??'')||receivable.verifiedByServer!==true||
  receivable.onHold!==false)return denied('RECEIVABLE_NOT_AVAILABLE');
 if(!exact(digitalEarnings,['driverId','settlementId','payablePyg',
  'fundsAvailable','verifiedByServer','paymentMethod','payoutPending'])||
  digitalEarnings.driverId!==driverId||!UUID.test(digitalEarnings.settlementId??'')||
  !pyg(digitalEarnings.payablePyg)||digitalEarnings.fundsAvailable!==true||
  digitalEarnings.verifiedByServer!==true||
  !['CARD','WALLET','SPI'].includes(digitalEarnings.paymentMethod)||
  digitalEarnings.payoutPending!==true)
  return denied('DIGITAL_FUNDS_NOT_AVAILABLE');
 // Preserve a configured portion of the next earned digital fare for Driver.
 // The policy is frozen and Owner-approved, not a rate supplied by the app.
 const capByPercent=Math.floor(digitalEarnings.payablePyg*policy.maxOffsetBps/10000);
 const capByMinimum=Math.max(0,digitalEarnings.payablePyg-policy.minimumDriverPayoutPyg);
 const offsetPyg=Math.min(receivable.outstandingPyg,digitalEarnings.payablePyg,
  capByPercent,capByMinimum);
 const driverPayoutPyg=digitalEarnings.payablePyg-offsetPyg;
 const cashDebtRemainingPyg=receivable.outstandingPyg-offsetPyg;
 if(!pyg(driverPayoutPyg)||!pyg(cashDebtRemainingPyg)||
  offsetPyg+driverPayoutPyg!==digitalEarnings.payablePyg)
  return denied('UNBALANCED_OFFSET');
 const journal=immutableEntries([
  {account:'qa_driver_payable',side:'debit',amountPyg:offsetPyg},
  {account:'qa_commission_due_from_driver',side:'credit',amountPyg:offsetPyg}
 ]);
 return Object.freeze({ok:true,mode:'STAGING_DEMO_ONLY',
  liveOperationsEnabled:false,debitedFromBank:false,transferSubmitted:false,
  payoutConfirmed:false,driverId,settlementId:digitalEarnings.settlementId,
  idempotencyKey:'CASH_OFFSET:'+digitalEarnings.settlementId,
  offsetPyg,driverPayoutPyg,cashDebtRemainingPyg,journal});
}
