import {verifySupportAccess} from './support-auth.mjs';
import {parseSupportActionIntent,parseSupportActionReceipt}
 from './support-action-contract.mjs';

/**
 * Future Edge Function transport, deliberately OFF by default.
 * This method does NOT perform client-side UPDATE/INSERT or pretend that
 * a successful queue receipt means a customer was contacted.
 * The server MUST independently authenticate Auth+AAL2+support assignment.
 */
export async function enqueueSupportAction(supabase,raw,{
 approved=false,now=Date.now
}={}){
 if(approved!==true)return Object.freeze({ok:false,code:'ACTION_BACKEND_DISABLED'});
 const intent=parseSupportActionIntent(raw);
 if(!intent)return Object.freeze({ok:false,code:'INVALID_ACTION'});
 const session=await verifySupportAccess(supabase,now);
 if(!session)return Object.freeze({ok:false,code:'NOT_AUTHORIZED'});
 try{
  if(typeof supabase?.functions?.invoke!=='function')
   return Object.freeze({ok:false,code:'SERVER_NOT_READY'});
  // Never accept user-supplied function names, routes, auth tokens or URLs.
  const response=await supabase.functions.invoke('qore-support-actions',{
   body:intent
  });
  if(response?.error)return Object.freeze({ok:false,code:'SERVER_NOT_READY'});
  const receipt=parseSupportActionReceipt(response?.data,intent);
  if(!receipt)return Object.freeze({ok:false,code:'UNTRUSTED_RECEIPT'});
  const later=await verifySupportAccess(supabase,now);
  if(!later||later.userId!==session.userId)
   return Object.freeze({ok:false,code:'SESSION_CHANGED'});
  return Object.freeze({
   ok:true,request_id:receipt.request_id,
   outcome:'QUEUED',ticket_id:receipt.ticket_id
  });
 }catch{return Object.freeze({ok:false,code:'NETWORK_UNAVAILABLE'});}
}
