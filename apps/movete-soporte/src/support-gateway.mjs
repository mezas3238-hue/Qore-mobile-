import {verifySupportAccess} from './support-auth.mjs';
import {parseSupportCasePage} from './support-contract.mjs';
const COLUMNS='ticket_id,case_code,category,summary,status,priority,assigned_support_id,updated_at';
/**
 * Read-only STAGING support ticket page. Supabase RLS must enforce
 * support assignment and AAL2, separately from client filtering.
 * No service_role, user-controlled endpoints or generic CRUD transport.
 */
export async function readSupportCases(supabase,now=Date.now){
 const session=await verifySupportAccess(supabase,now);
 if(!session)return Object.freeze({ok:false,code:'NOT_AUTHORIZED'});
 try{
  const response=await supabase.from('mobility_stage_support_cases')
   .select(COLUMNS).order('updated_at',{ascending:false}).limit(50);
  if(response.error)return Object.freeze({ok:false,code:'SERVER_NOT_READY'});
  const cases=parseSupportCasePage(response.data);
  if(cases===null)return Object.freeze({ok:false,code:'UNTRUSTED_CASES'});
  const later=await verifySupportAccess(supabase,now);
  if(!later||later.userId!==session.userId)
   return Object.freeze({ok:false,code:'SESSION_CHANGED'});
  // Never return original server transport or user/account identifiers.
  return Object.freeze({ok:true,cases,live:false,readOnly:true});
 }catch{return Object.freeze({ok:false,code:'NETWORK_UNAVAILABLE'});}
}
