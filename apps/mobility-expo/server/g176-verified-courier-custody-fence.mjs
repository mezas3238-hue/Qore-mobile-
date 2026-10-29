/**
 * G176 - remove the second custody authority from the G4 public HTTP runtime.
 * Direct G5 /deliveries/:id/transition allowed pickup/return via only
 * Supabase getUser and role lookup, bypassing the independently attested,
 * revocable Driver G66 route. Delivery G67 proves final receipt at SQL commit
 * but does not independently protect an earlier pickup event. Deny all
 * courier transition attempts here, even with a valid old Driver token.
 *
 * Original G5 Sender cancel/dispute and GETs, G121 recovery, G122 price
 * consent, and G66 courier custody remain separate. QA-only, no LIVE.
 */
const TRANSITION=/^\/v1\/staging\/deliveries\/[0-9a-f-]{36}\/transition$/i;
const COURIER_ACTIONS=new Set(['pickup','deliver','return']);
const reject=()=>({status:409,body:{
 code:'G176_USE_VERIFIED_G66_COURIER_CUSTODY',
 qaOnly:true,productionEnabled:false,retryLegacyRequest:false,
 deliveryConfirmed:false
}});
export function createG176VerifiedCourierCustodyFence({deliveryHandler}={}){
 if(typeof deliveryHandler!=='function')
  throw Error('G176 original delivery command handler required');
 return async input=>{
  if(input?.method==='POST'&&typeof input.path==='string'&&
   TRANSITION.test(input.path)&&COURIER_ACTIONS.has(input.body?.event))
   return reject();
  return deliveryHandler(input);
 };
}
