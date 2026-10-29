/**
 * G175 — one original Buyer ordering authority in the unified G4 runtime.
 *
 * G45 + G139 own stock reservation, revision, idempotent request key,
 * Buyer cancellation, and G144 recovery under G42. Legacy G6 exposed
 * /buyer/orders/request and /buyer/orders/:id/transition as a second write
 * authority without the original G45/G42 buyer fence. Forbid those writes
 * even if an older app sends them; do not mutate inventory or fake success.
 *
 * Merchant actions remain G173 independently attested, and status GETs
 * continue through G6's original actor-scoped SQL projection. QA only.
 */
const LEGACY_BUYER_ORDER=/^\/v1\/staging\/buyer\/orders\/request$/i;
const LEGACY_BUYER_TRANSITION=
 /^\/v1\/staging\/buyer\/orders\/[0-9a-f-]{36}\/transition$/i;
const BUYER_PREFIX=/^\/v1\/staging\/buyer\/orders\//i;
const deny=()=>({status:409,body:{
 code:'G175_USE_ORIGINAL_G45_G139_BUYER_ORDER',
 qaOnly:true,productionEnabled:false,
 retryLegacyRequest:false,paymentEnabled:false
}});
export function createG175SovereignBuyerCommerceFence({merchantHandler}={}){
 if(typeof merchantHandler!=='function')
  throw Error('G175 original merchant handler required');
 return async input=>{
  const path=input?.path;
  if(typeof path==='string'&&(
   LEGACY_BUYER_ORDER.test(path)||
   LEGACY_BUYER_TRANSITION.test(path)||
   // Unknown Buyer order route variations must not fall through to G6.
   (BUYER_PREFIX.test(path)&&!path.toLowerCase().includes('/qa/'))
  ))return deny();
  return merchantHandler(input);
 };
}
