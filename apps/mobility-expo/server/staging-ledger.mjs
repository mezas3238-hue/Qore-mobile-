/** QORE synthetic double-entry ledger. No payments or settlement. */
export const LEDGER_LIVE_ENABLED=false;
const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const fail=reason=>({ok:false,reason,liveEnabled:false});
/** Record customer payment allocation: provider earnings + platform commission. */
export function buildSyntheticSettlement({quote,transactionId}={}){
 if(!quote||quote.ok!==true||quote.liveEnabled!==false||typeof transactionId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(transactionId)||!integer(quote.totalPyg)||!integer(quote.commissionPyg)||!integer(quote.providerPyg)||!integer(quote.subtotalPyg)||!integer(quote.tollsPyg)||!integer(quote.commissionBps)||quote.commissionBps>3000||quote.subtotalPyg+quote.tollsPyg!==quote.totalPyg||Math.floor((quote.subtotalPyg*quote.commissionBps+5000)/10000)!==quote.commissionPyg||quote.commissionPyg+quote.providerPyg!==quote.totalPyg)return fail('Invalid synthetic settlement');
 const entries=[
  {account:'synthetic_cash_clearing',side:'debit',amountPyg:quote.totalPyg},
  {account:'synthetic_provider_payable',side:'credit',amountPyg:quote.providerPyg},
  {account:'synthetic_platform_commission',side:'credit',amountPyg:quote.commissionPyg},
 ];
 return {ok:true,liveEnabled:false,transactionId,entries};
}
export function verifyBalancedEntries(entries){
 if(!Array.isArray(entries)||entries.length===0)return false;
 let debits=0,credits=0;
 for(const e of entries){
  if(!e||!['debit','credit'].includes(e.side)||!integer(e.amountPyg)||typeof e.account!=='string'||!/^synthetic_[a-z_]+$/.test(e.account))return false;
  if(e.side==='debit')debits+=e.amountPyg;else credits+=e.amountPyg;
 }
 return Number.isSafeInteger(debits)&&Number.isSafeInteger(credits)&&debits===credits;
}
