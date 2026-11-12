/**
 * G320 support claim Edge Function CANDIDATE (NOT DEPLOYED).
 * The client provides ONLY ticket_id and idempotency_key.
 * Identity, AAL2 and session ID are verified server-side.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import {createSupportClaimHandler as untypedHandler} from '../../src/support-claim-http.mjs';

type Identity=Readonly<{
 userId:string;sessionId:string;aal:string;role:string;isAnonymous:boolean
}>;
type Intent=Readonly<{ticket_id:string;idempotency_key:string}>;
type Receipt=Readonly<{claim_id:string;ticket_id:string;outcome:'CLAIMED'}>;
const createSupportClaimHandler=untypedHandler as (opts:{
 enabled:boolean;allowedOrigin:string;
 resolveIdentity:(token:string)=>Promise<Identity|null>;
 claim:(identity:Identity,intent:Intent)=>Promise<Receipt|null>;
})=>(request:Request)=>Promise<Response>;

const url=Deno.env.get('SUPABASE_URL')??'';
const publishable=Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??
 Deno.env.get('SUPABASE_ANON_KEY')??'';
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const enabled=Deno.env.get('QORE_SUPPORT_CLAIMS_ENABLED')==='true' &&
 Boolean(url&&publishable&&secret);
const auth=enabled?createClient(url,publishable,{
 auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
}):null;
const server=enabled?createClient(url,secret,{
 auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
}):null;

function verifiedClaims(jwt:string){
 try{
  const parts=jwt.split('.');
  if(parts.length!==3||parts[1].length>12000)return null;
  const payload=parts[1].replace(/-/g,'+').replace(/_/g,'/');
  const decoded=atob(payload+'='.repeat((4-payload.length%4)%4));
  const claims=JSON.parse(decoded);
  if(!claims||typeof claims!=='object'||Array.isArray(claims))return null;
  return claims;
 }catch{return null;}
}
const handler=createSupportClaimHandler({
 enabled,allowedOrigin:Deno.env.get('QORE_SUPPORT_ALLOWED_ORIGIN')??'',
 resolveIdentity:async jwt=>{
  if(!auth)return null;
  const {data,error}=await auth.auth.getUser(jwt);
  if(error||!data?.user||data.user.is_anonymous===true)return null;
  const claims=verifiedClaims(jwt);
  if(!claims||claims.sub!==data.user.id)return null;
  return {userId:data.user.id,sessionId:claims.session_id,
   aal:claims.aal,role:claims.role,isAnonymous:false};
 },
 claim:async(identity,intent)=>{
  if(!server)throw Error('disabled');
  const {data,error}=await server.rpc('mobility_stage_g320_claim_ticket_qa',{
   p_actor:identity.userId,
   p_session:identity.sessionId,
   p_ticket:intent.ticket_id,
   p_idempotency_key:intent.idempotency_key
  });
  if(error)throw Error('denied');
  return data as Receipt|null;
 }
});
Deno.serve(request=>handler(request));
