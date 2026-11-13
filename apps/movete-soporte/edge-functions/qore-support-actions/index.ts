/**
 * G314 STAGING-only candidate. NOT DEPLOYED.
 * Function path: apps/movete-soporte/edge-functions/qore-support-actions.
 *
 * Never expose SUPABASE_SERVICE_ROLE_KEY in VITE_*, the browser or logs.
 * Deploy requires explicit QORE_SUPPORT_ACTIONS_ENABLED=true AND an exact
 * QORE_SUPPORT_ALLOWED_ORIGIN; both default to OFF/empty.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import {createSupportActionHandler as createUntypedHandler} from '../../src/support-action-http.mjs';
// The Node-tested .mjs boundary needs an explicit type contract in Deno;
// the handler validates the returned RPC JSON at runtime.
type SupportIdentity=Readonly<{
 userId:string;sessionId:string;role:string;aal:string;isAnonymous:boolean;
}>;
type SupportIntent=Readonly<{
 ticket_id:string;expected_status:string;action:string;idempotency_key:string;
}>;
type SupportReceipt=Readonly<{
 request_id:string;ticket_id:string;action:string;outcome:'QUEUED';
}>;
type SupportGatewayOptions={
 enabled:boolean;allowedOrigin:string;
 resolveIdentity:(token:string)=>Promise<SupportIdentity|null>;
 enqueue:(identity:SupportIdentity,intent:SupportIntent)=>Promise<SupportReceipt|null>;
};
const createSupportActionHandler=createUntypedHandler as
 (opts:SupportGatewayOptions)=>(request:Request)=>Promise<Response>;

const apiUrl=Deno.env.get('SUPABASE_URL')??'';
const publicKey=Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??
 Deno.env.get('SUPABASE_ANON_KEY')??'';
const privateKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const enabled=Deno.env.get('QORE_SUPPORT_ACTIONS_ENABLED')==='true' &&
 Boolean(apiUrl&&publicKey&&privateKey);
const authClient=enabled?createClient(apiUrl,publicKey,{
 auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
}):null;
const serverClient=enabled?createClient(apiUrl,privateKey,{
 auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
}):null;

/** Parse claims only AFTER Supabase Auth confirms the JWT with getUser(). */
function verifiedClaims(accessToken:string){
 try{
  const pieces=accessToken.split('.');
  if(pieces.length!==3||pieces[1].length>12000)return null;
  const segment=pieces[1].replace(/-/g,'+').replace(/_/g,'/');
  const body=atob(segment+'='.repeat((4-segment.length%4)%4));
  const claim=JSON.parse(body);
  if(!claim||typeof claim!=='object'||Array.isArray(claim))return null;
  return claim;
 }catch{return null;}
}
const handle=createSupportActionHandler({
 enabled,
 allowedOrigin:Deno.env.get('QORE_SUPPORT_ALLOWED_ORIGIN')??'',
 resolveIdentity:async(token)=>{
  if(!authClient)return null;
  const {data,error}=await authClient.auth.getUser(token);
  if(error||!data?.user||data.user.is_anonymous===true)return null;
  const claim=verifiedClaims(token);
  if(!claim||claim.sub!==data.user.id)return null;
  return {
   userId:data.user.id,sessionId:claim.session_id,
   aal:claim.aal,role:claim.role,isAnonymous:false
  };
 },
 enqueue:async(identity,intent)=>{
  if(!serverClient)throw Error('disabled');
  const {data,error}=await serverClient.rpc('mobility_stage_g314_enqueue_action_qa',{
   p_actor:identity.userId,
   p_session:identity.sessionId,
   p_ticket:intent.ticket_id,
   p_expected_status:intent.expected_status,
   p_action:intent.action,
   p_idempotency_key:intent.idempotency_key
  });
  if(error)throw Error('denied');
  return data as SupportReceipt|null;
 }
});
Deno.serve(request=>handle(request));
