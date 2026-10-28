/**
 * Admin Auth client for isolated STAGING. Password alone is NOT an Admin
 * session: the provider MUST attest AAL2 with a VERIFIED TOTP enrollment
 * and server Auth getUser; RLS MUST return exactly one matching Admin/Owner
 * role. G75 backend rechecks JWT, provider MFA, RBAC and session revocation.
 *
 * Browser has memory-only token storage. Never rely on a local JWT decode.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
const clock=x=>Number.isSafeInteger(x)&&x>0;
export function createWebAdminAuth({supabase,now=Date.now}={}){
 if(!supabase||typeof now!=='function'||
  typeof supabase.auth?.getSession!=='function'||
  typeof supabase.auth?.getUser!=='function'||
  typeof supabase.auth?.signInWithPassword!=='function'||
  typeof supabase.auth?.signOut!=='function'||
  typeof supabase.auth?.mfa?.getAuthenticatorAssuranceLevel!=='function'||
  typeof supabase.auth?.mfa?.listFactors!=='function'||
  typeof supabase.auth?.mfa?.challengeAndVerify!=='function'||
  typeof supabase.from!=='function')
  throw Error('Admin requires provider-certified AAL2 and RLS');
 let busy=false;
 async function factor(){
  const listed=await supabase.auth.mfa.listFactors();
  if(listed.error||!Array.isArray(listed.data?.totp))return null;
  const active=listed.data.totp.filter(x=>
   x?.status==='verified'&&typeof x.id==='string'&&UUID.test(x.id));
  return active.length===1?active[0].id:null;
 }
 async function readSession(){
  const stored=await supabase.auth.getSession();
  if(stored.error)return null;
  const s=stored.data?.session;
  const expiry=Number(s?.expires_at)*1000;
  if(!s||typeof s.access_token!=='string'||s.access_token.length<20||
   s.access_token.length>7900||!clock(expiry)||expiry<=now()+1000)
   return null;
  // Strong Auth reads: network user, provider assurance, verified TOTP factor.
  const [verified,assurance,totpId]=await Promise.all([
   supabase.auth.getUser(s.access_token),
   supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
   factor()
  ]);
  const user=verified.data?.user,aal=assurance.data;
  if(verified.error||assurance.error||!user||!UUID.test(user.id)
   ||s.user?.id!==user.id||user.is_anonymous===true||
   !(typeof user.email_confirmed_at==='string'
     ||typeof user.phone_confirmed_at==='string')||
   aal?.currentLevel!=='aal2'||totpId===null)
   return null;
  const roles=await supabase.from('user_roles').select('role')
   .eq('user_id',user.id).limit(3);
  if(roles.error||!Array.isArray(roles.data)||roles.data.length!==1||
   !['admin','owner'].includes(roles.data[0]?.role))
   return null;
  // Client gate protects display only; G75 will independently verify AAL2
  // and Admin role from its real IdP, backoffice registry and RLS.
  return Object.freeze({role:roles.data[0].role,
   subject:user.id,token:s.access_token,
   mfaVerified:true,expiresAt:expiry});
 }
 async function signIn(email,password){
  if(busy)return fail('AUTH_BUSY');
  if(typeof email!=='string'||email.length>254||
   !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())||
   typeof password!=='string'||password.length<8||password.length>256)
   return fail('INVALID_AUTH_INPUT');
  busy=true;
  try{
   const {error}=await supabase.auth.signInWithPassword({
    email:email.trim().toLowerCase(),password
   });
   if(error)return fail('AUTH_UNAVAILABLE_OR_INVALID');
   const status=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   const enrolled=await factor();
   if(status.error||enrolled===null||
    !['aal1','aal2'].includes(status.data?.currentLevel)){
    await supabase.auth.signOut();
    return fail('MFA_ENROLLMENT_REQUIRED');
   }
   if(status.data.currentLevel!=='aal2')return fail('MFA_REQUIRED');
   const verified=await readSession();
   if(!verified){await supabase.auth.signOut();return fail('ADMIN_ROLE_NOT_VERIFIED');}
   return Object.freeze({ok:true,role:verified.role});
  }catch{return fail('AUTH_UNAVAILABLE');}
  finally{busy=false;}
 }
 async function verifyTotp(code){
  if(busy)return fail('AUTH_BUSY');
  if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))return fail('INVALID_TOTP');
  busy=true;
  try{
   const factorId=await factor();
   if(!factorId)return fail('MFA_ENROLLMENT_REQUIRED');
   const response=await supabase.auth.mfa.challengeAndVerify({factorId,code});
   if(response.error)return fail('MFA_DENIED');
   const account=await readSession();
   if(!account){await supabase.auth.signOut();return fail('ADMIN_ROLE_NOT_VERIFIED');}
   return Object.freeze({ok:true,role:account.role});
  }catch{return fail('AUTH_UNAVAILABLE');}
  finally{busy=false;}
 }
 async function signOut(){
  const result=await supabase.auth.signOut();
  if(result.error)throw Error('Remote Admin logout not confirmed');
 }
 return Object.freeze({readSession,signIn,verifyTotp,signOut});
}
