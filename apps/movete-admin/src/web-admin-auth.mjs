/**
 * Admin Auth client for isolated STAGING. Password alone is NOT an Admin
 * session: the provider MUST attest AAL2 with a VERIFIED TOTP enrollment
 * and server Auth getUser; G264 returns only the caller's exclusive
 * G27-backoffice role under Auth JWT AAL2. No user_roles bypass. The backend
 * separately rechecks JWT, provider MFA, RBAC and session revocation.
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
  typeof supabase.auth?.mfa?.enroll!=='function'||
  typeof supabase.rpc!=='function')
  throw Error('Admin requires provider-certified AAL2 and RLS');
 let busy=false;
 // A temporary AAL1 session is permitted ONLY for MFA self-enrollment.
 // It is never returned from readSession or allowed to call a privileged RPC.
 let enrollmentAllowed=false,enrollmentFactor=null;
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
  // IMPORTANT: G27 forbids users present in native user_roles. Query only
  // the minimal AAL2 self-role disclosure from its SAME private registry.
  // Never query mobility_stage_backoffice_roles directly from the browser.
  const own=await supabase.rpc('mobility_stage_g264_my_backoffice_role');
  if(own.error||!['admin','owner'].includes(own.data))
   return null;
  // This browser gate does not authorize requests: G27/G42/G260 still do.
  return Object.freeze({role:own.data,
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
  enrollmentAllowed=false;enrollmentFactor=null;
  try{
   const {error}=await supabase.auth.signInWithPassword({
    email:email.trim().toLowerCase(),password
   });
   if(error)return fail('AUTH_UNAVAILABLE_OR_INVALID');
   const status=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   const enrolled=await factor();
   if(status.error||!['aal1','aal2'].includes(status.data?.currentLevel)){
    await supabase.auth.signOut();
    return fail('MFA_ASSURANCE_UNAVAILABLE');
   }
   if(enrolled===null){
    // Do not confuse 0 verified factors with multiple/invalid verified
    // factors. Only a single newly signed-in identity with exactly zero
    // factors may begin setup, and no backoffice role is disclosed at AAL1.
    const listed=await supabase.auth.mfa.listFactors();
    const sess=await supabase.auth.getSession();
    const access=sess.data?.session?.access_token;
    const id=sess.data?.session?.user?.id;
    const user=typeof access==='string'?await supabase.auth.getUser(access):null;
    const factorRows=listed.data?.totp;
    if(status.data.currentLevel==='aal1'&&!listed.error&&
     Array.isArray(factorRows)&&factorRows.length===0&&
     !sess.error&&!user?.error&&UUID.test(id??'')&&
     user?.data?.user?.id===id&&
     user.data.user.is_anonymous!==true&&
     (typeof user.data.user.email_confirmed_at==='string'||
      typeof user.data.user.phone_confirmed_at==='string')){
     enrollmentAllowed=true;
     return fail('MFA_ENROLLMENT_REQUIRED');
    }
    await supabase.auth.signOut();
    return fail('MFA_FACTOR_NOT_ELIGIBLE');
   }
   if(status.data.currentLevel!=='aal2')return fail('MFA_REQUIRED');
   const verified=await readSession();
   if(!verified){await supabase.auth.signOut();return fail('ADMIN_ROLE_NOT_VERIFIED');}
   return Object.freeze({ok:true,role:verified.role});
  }catch{return fail('AUTH_UNAVAILABLE');}
  finally{busy=false;}
 }
 async function beginTotpEnrollment(){
  if(busy)return fail('AUTH_BUSY');
  if(!enrollmentAllowed||enrollmentFactor!==null)
   return fail('MFA_SETUP_NOT_AUTHORIZED');
  busy=true;
  try{
   const status=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   const sess=await supabase.auth.getSession();
   const access=sess.data?.session?.access_token;
   const own=sess.data?.session?.user?.id;
   const user=typeof access==='string'?await supabase.auth.getUser(access):null;
   if(status.error||status.data?.currentLevel!=='aal1'||
    sess.error||!UUID.test(own??'')||user?.error||
    user?.data?.user?.id!==own||
    user.data.user.is_anonymous===true)
    return fail('MFA_SETUP_SESSION_INVALID');
   const enrolled=await supabase.auth.mfa.enroll({
    factorType:'totp',friendlyName:'Movete Facil STAGING'
   });
   const id=enrolled.data?.id,secret=enrolled.data?.totp?.secret;
   if(enrolled.error||!UUID.test(id??'')||
    typeof secret!=='string'||!/^[A-Z2-7]{16,128}$/i.test(secret))
    return fail('MFA_SETUP_UNAVAILABLE');
   enrollmentFactor=id;
   // Never return the OTP URI, JWT or any role. Secret must only be shown
   // to the authenticated user temporarily, never logged or persisted.
   return Object.freeze({ok:true,secret});
  }catch{return fail('MFA_SETUP_UNAVAILABLE');}
  finally{busy=false;}
 }
 async function verifyEnrolledTotp(code){
  if(busy)return fail('AUTH_BUSY');
  if(!enrollmentAllowed||!UUID.test(enrollmentFactor??''))
   return fail('MFA_SETUP_NOT_AUTHORIZED');
  if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))
   return fail('INVALID_TOTP');
  busy=true;
  try{
   const result=await supabase.auth.mfa.challengeAndVerify({
    factorId:enrollmentFactor,code
   });
   if(result.error)return fail('MFA_DENIED');
   const registered=await factor();
   if(registered!==enrollmentFactor){
    enrollmentAllowed=false;enrollmentFactor=null;
    await supabase.auth.signOut();
    return fail('MFA_FACTOR_NOT_VERIFIED');
   }
   enrollmentAllowed=false;enrollmentFactor=null;
   const owner=await readSession();
   if(!owner){
    await supabase.auth.signOut();
    return fail('BACKOFFICE_ROLE_NOT_APPROVED');
   }
   return Object.freeze({ok:true,role:owner.role});
  }catch{return fail('MFA_SETUP_UNAVAILABLE');}
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
  enrollmentAllowed=false;enrollmentFactor=null;
  const result=await supabase.auth.signOut();
  if(result.error)throw Error('Remote Admin logout not confirmed');
 }
 return Object.freeze({readSession,signIn,beginTotpEnrollment,verifyEnrolledTotp,verifyTotp,signOut});
}
