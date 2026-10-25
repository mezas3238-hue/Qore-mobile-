/** QORE synthetic double-entry ledger. No payments or settlement. */
import {verifySyntheticQuote,verifySyntheticRideCampaignQuote} from './fare-engine.mjs';
export const LEDGER_LIVE_ENABLED=false;
const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const fail=reason=>({ok:false,reason,liveEnabled:false});
/** Record customer payment allocation: provider earnings + platform commission. */
export function buildSyntheticSettlement({quote,transactionId}={}){
 if(!verifySyntheticQuote(quote)||typeof transactionId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(transactionId)||!integer(quote.totalPyg)||!integer(quote.commissionPyg)||!integer(quote.providerPyg)||!integer(quote.subtotalPyg)||!integer(quote.tollsPyg)||!integer(quote.commissionBps)||quote.commissionBps>3000||quote.subtotalPyg+quote.tollsPyg!==quote.totalPyg||Math.floor((quote.subtotalPyg*quote.commissionBps+5000)/10000)!==quote.commissionPyg||quote.commissionPyg+quote.providerPyg!==quote.totalPyg)return fail('Invalid synthetic settlement');
 const entries=[
  {account:'synthetic_cash_clearing',side:'debit',amountPyg:quote.totalPyg},
  {account:'synthetic_provider_payable',side:'credit',amountPyg:quote.providerPyg},
  {account:'synthetic_platform_commission',side:'credit',amountPyg:quote.commissionPyg},
 ];
 return {ok:true,liveEnabled:false,transactionId,entries};
}
export function verifyBalancedEntries(entries){
 if(!Array.isArray(entries)||entries.length!==3)return false;
 const expected=['synthetic_cash_clearing','synthetic_provider_payable','synthetic_platform_commission'];
 if(entries.some((e,i)=>e?.account!==expected[i]||e.side!==(i===0?'debit':'credit')))return false;
 let debits=0,credits=0;
 for(const e of entries){
  if(!e||!['debit','credit'].includes(e.side)||!integer(e.amountPyg)||typeof e.account!=='string'||!/^synthetic_[a-z_]+$/.test(e.account))return false;
  if(e.side==='debit')debits+=e.amountPyg;else credits+=e.amountPyg;
 }
 return Number.isSafeInteger(debits)&&Number.isSafeInteger(credits)&&debits===credits;
}


/**
 * Auditable two-sided ride subsidy, QA only, NOT PSP capture/payout.
 * Dr customer clearing + Dr subsidy expense = Cr Driver + Cr gross platform fee.
 * Platform net = gross fee - subsidy; this is NOT net profit after operations.
 * The eventual persistent SQL writer MUST enforce UNIQUE(bookingKey,serviceKind)
 * and use atomic reservation/ledger commit for replay-safe settlement.
 */
export function buildSyntheticRideCampaignSettlement({quote,transactionId}={}){
 if(!verifySyntheticRideCampaignQuote(quote)||
    typeof transactionId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(transactionId))
  return {ok:false,reason:'Unverified campaign ride settlement',liveEnabled:false};
 const entries=[
  {account:'synthetic_customer_clearing',side:'debit',amountPyg:quote.customerPaysGs},
  {account:'synthetic_customer_subsidy',side:'debit',amountPyg:quote.customerSubsidyGs},
  {account:'synthetic_driver_payable',side:'credit',amountPyg:quote.driverReceivesGs},
  {account:'synthetic_gross_commission',side:'credit',amountPyg:quote.grossCommissionGs}
 ];
 if(!verifySyntheticRideCampaignEntries(entries,quote))
  return {ok:false,reason:'Unbalanced campaign ride ledger',liveEnabled:false};
 return Object.freeze({ok:true,liveEnabled:false,transactionId,
  serviceKind:quote.serviceKind,bookingKey:quote.bookingKey,tripId:quote.tripId,
  campaignId:quote.campaign.campaignId,
  platformRetainsGs:quote.platformRetainsGs,
  entries:Object.freeze(entries.map(e=>Object.freeze(e)))});
}
export function verifySyntheticRideCampaignEntries(entries,quote){
 if(!verifySyntheticRideCampaignQuote(quote)||!Array.isArray(entries)||entries.length!==4)return false;
 const expected=[
  ['synthetic_customer_clearing','debit','customerPaysGs'],
  ['synthetic_customer_subsidy','debit','customerSubsidyGs'],
  ['synthetic_driver_payable','credit','driverReceivesGs'],
  ['synthetic_gross_commission','credit','grossCommissionGs']
 ];
 let dr=0,cr=0;
 for(let i=0;i<4;i++){
  const e=entries[i], [account,side,field]=expected[i];
  if(!e||e.account!==account||e.side!==side||
    !Number.isSafeInteger(e.amountPyg)||e.amountPyg<0||
    e.amountPyg!==quote[field]||Object.keys(e).length!==3)return false;
  if(side==='debit')dr+=e.amountPyg;else cr+=e.amountPyg;
 }
 return Number.isSafeInteger(dr)&&Number.isSafeInteger(cr)&&
  dr===cr&&dr===quote.originalFareGs&&
  quote.platformRetainsGs===quote.grossCommissionGs-quote.customerSubsidyGs;
}
