import {verifySupportAccess} from './support-auth.mjs';
import {parseSupportClaimIntent,parseSupportClaimReceipt} from './support-claim-contract.mjs';
/**
 * G320 browser transport, OFF by default. Actual claim authority belongs
 * to private PostgreSQL G320, NOT this UI or its locally cached tickets.
 */
export async function claimSupportCase(supabase,raw,{approved=false,now=Date.now}={}){
 if(approved!==true)return Object.freeze({ok:false,code:'CLAIM_BACKEND_DISABLED'});
 const intent=parseSupportClaimIntent(raw);
 if(!intent)return Object.freeze({ok:false,code:'INVALID_CLAIM'});
 const previous=await verifySupportAccess(supabase,now);
 if(!previous)return Object.freeze({ok:false,code:'NOT_AUTHORIZED'});
 try{
  if(typeof supabase?.functions?.invoke!=='function')
   return Object.freeze({ok:false,code:'SERVER_NOT_READY'});
  const response=await supabase.functions.invoke('qore-support-claim',{body:intent});
  if(response?.error)return Object.freeze({ok:false,code:'CLAIM_NOT_AUTHORIZED'});
  const parsed=parseSupportClaimReceipt(response?.data,intent);
  if(!parsed)return Object.freeze({ok:false,code:'INVALID_RECEIPT'});
  const latest=await verifySupportAccess(supabase,now);
  if(!latest||latest.userId!==previous.userId)
   return Object.freeze({ok:false,code:'SESSION_CHANGED'});
  return Object.freeze({
   ok:true,claim_id:parsed.claim_id,ticket_id:parsed.ticket_id,outcome:'CLAIMED'
  });
 }catch{return Object.freeze({ok:false,code:'NETWORK_UNAVAILABLE'});}
}
