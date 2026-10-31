/**
 * G260 — opt-in, Supabase provider-backed Admin AAL2 trust for isolated
 * STAGING. This bridge does not elevate users to Admin: G27 SQL checks
 * exclusive role and scopes, while original G75/G142/G145/G146 gateways
 * verify this AAL2 proof on every request. No JWT or MFA code is logged.
 *
 * Supabase Auth getUser(token) must independently verify the JWT before we
 * inspect the signed aal/amr claims. G42 SQL validates the exact live session.
 * A bounded memory map carries the original issued iat to the legacy
 * gateway's subsequent revocation callback; the database ALWAYS rechecks.
 */
import {createQoreG247ProviderSessionTrust}
 from './g247-supabase-provider-session-trust.mjs';
const REF='mrjzxftsdxzepzbcuids';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MFA_METHODS=new Set(['totp','phone','webauthn']);
const MAX=256,MAX_AGE=43_200_000;
const denied=()=>Error('G260 independent Admin AAL2 unavailable');
function mfaTimestamp(token,at){
 if(typeof token!=='string'||token.length>8192)throw denied();
 let payload;
 try{payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}
 catch{throw denied();}
 if(payload?.aal!=='aal2'||!Array.isArray(payload.amr))throw denied();
 let last=-1;
 for(const x of payload.amr){
  if(!x||typeof x!=='object'||Array.isArray(x)||!MFA_METHODS.has(x.method)||
   !Number.isSafeInteger(x.timestamp))continue;
  const v=x.timestamp*1000;
  if(!Number.isSafeInteger(v)||v<=0||v>at||at-v>MAX_AGE)continue;
  last=Math.max(last,v);
 }
 if(last<0)throw denied();
 return last;
}
export function createQoreG260AdminAal2Trust({
 projectRef,auth,db,now=Date.now,allowedByOwner=false,liveEnabled=false
}={}){
 if(projectRef!==REF||allowedByOwner!==true||liveEnabled!==false||
  typeof auth?.getUser!=='function'||typeof db?.rpc!=='function'||
  typeof now!=='function')throw denied();
 const provider=createQoreG247ProviderSessionTrust({
  projectRef,auth,db,now,allowedByOwner:true,liveEnabled:false
 });
 const cache=new Map();
 const slot=(id,session)=>id.toLowerCase()+':'+session.toLowerCase();
 const prune=()=>{
  for(const [k,x] of cache)if(x.expiresAtMs<=now())cache.delete(k);
  while(cache.size>=MAX)cache.delete(cache.keys().next().value);
 };
 const verifyAdminSession=async token=>{
  const p=await provider.verifyParticipantSession(token);
  prune();
  cache.set(slot(p.id,p.sessionId),{
   tokenIatMs:p.tokenIatMs,expiresAtMs:p.expiresAtMs
  });
  return p;
 };
 return Object.freeze({
  verifyAdminSession,
  verifySessionNotRevoked:async({userId,sessionId}={})=>{
   if(!UUID.test(userId??'')||!UUID.test(sessionId??''))return false;
   const x=cache.get(slot(userId,sessionId));
   if(!x||x.expiresAtMs<=now())return false;
   return provider.verifySessionNotRevoked({
    userId,sessionId,tokenIatMs:x.tokenIatMs
   });
  },
  verifyBackofficeMfa:async({token,userId,sessionId,requiredLevel,at}={})=>{
   if(requiredLevel!=='aal2'||!UUID.test(userId??'')||
    !UUID.test(sessionId??'')||!Number.isSafeInteger(at)||at>now()+1000||
    now()-at>5000)throw denied();
   // Verify provider identity AND G42 revocation on this exact bearer again,
   // not claims alone or an earlier request's session cache.
   const p=await provider.verifyParticipantSession(token);
   if(p.id!==userId.toLowerCase()||p.sessionId!==sessionId.toLowerCase()||
    p.expiresAtMs<=at||!(await provider.verifySessionNotRevoked({
     userId,sessionId,tokenIatMs:p.tokenIatMs
    })))throw denied();
   const verifiedAtMs=mfaTimestamp(token,at);
   return Object.freeze({
    verifiedByProvider:true,userId:p.id,sessionId:p.sessionId,
    assuranceLevel:'aal2',verifiedAtMs,expiresAtMs:p.expiresAtMs
   });
  }
 });
}
