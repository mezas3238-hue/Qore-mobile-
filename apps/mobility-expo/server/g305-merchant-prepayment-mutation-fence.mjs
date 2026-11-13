/**
 * G305 commerce PREPAY LOCK: all merchant-state-changing HTTP routes remain
 * disabled in Railway/STAGING until a PSP-settled order grant can be proven
 * inside the SAME PostgreSQL transaction as the merchant mutation.
 *
 * Existing synthetic PG16 CI exercises original G173 in isolation. Do not
 * elevate legacy QA events to commercial evidence.
 */
export const G305_MERCHANT_PREPAID_MUTATIONS_ENABLED=false;
const MERCHANT_ORDERS=/^\/v1\/staging\/merchant\/orders(?:\/|$)/i;
const deny=()=>({status:409,body:{
  code:'G305_MERCHANT_PREPAYMENT_ATOMIC_GATE_NOT_CERTIFIED',
  qaOnly:true,productionEnabled:false,merchantPreparationEnabled:false,
  merchantDispatchEnabled:false,paymentCaptured:false,
  retryWithCash:false
}});
/** Reject every mutation entrypoint under Merchant Orders, not only
 * known endpoint spellings. Does not touch unrelated Buyer reservation,
 * Buyer recovery, independent admin/read or private Driver APIs.
 */
export function createG305MerchantPrepaymentMutationFence({merchantHandler}={}){
 if(typeof merchantHandler!=='function')throw Error('G305 original Merchant handler required');
 return async input=>{
  const path=input?.path;
  if(typeof path==='string'&&MERCHANT_ORDERS.test(path))
   return deny();
  return merchantHandler(input);
 };
}
