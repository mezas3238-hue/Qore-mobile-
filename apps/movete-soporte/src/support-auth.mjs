/**
 * Independent Support Auth: signed-in verified identity + AAL2 TOTP and
 * support-only server role. G27 Owner/Admin is not inherited. No mutation.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export async function verifySupportAccess(supabase,now=Date.now){
 try{
  if(!supabase?.auth?.getSession||!supabase?.auth?.getUser||
    !supabase?.auth?.mfa?.getAuthenticatorAssuranceLevel||
    !supabase?.auth?.mfa?.listFactors||!supabase?.rpc)return null;
  const s=await supabase.auth.getSession();
  const sess=s?.data?.session;
  if(s?.error||!sess||!UUID.test(sess.user?.id??'')||
    typeof sess.access_token!=='string'||sess.access_token.length<20||
    !Number.isFinite(sess.expires_at)||
    sess.expires_at*1000<now()+1000)return null;
  const [identified,assurance,factors]=await Promise.all([
   supabase.auth.getUser(sess.access_token),
   supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
   supabase.auth.mfa.listFactors()
  ]);
  const user=identified?.data?.user,totp=factors?.data?.totp;
  if(identified?.error||assurance?.error||factors?.error||
   !user||user.id!==sess.user.id||user.is_anonymous===true||
   !(user.email_confirmed_at||user.phone_confirmed_at)||
   assurance?.data?.currentLevel!=='aal2'||
   !Array.isArray(totp)||!totp.some(f=>f?.status==='verified'&&
    f.factor_type==='totp'&&UUID.test(f.id??'')))return null;
  // Server RPC must verify its OWN independent support staff registry,
  // that no concurrent Driver/Customer/Owner/Admin role is held, and AAL2.
  const role=await supabase.rpc('mobility_stage_support_my_role');
  if(role?.error||role?.data!=='support')return null;
  return Object.freeze({userId:user.id,expiresAt:sess.expires_at*1000});
 }catch{return null;}
}
export async function supportPasswordLogin(supabase,email,password){
 if(typeof email!=='string'||email.length>254||
  !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())||
  typeof password!=='string'||password.length<8||password.length>256)
  return Object.freeze({ok:false,code:'INVALID_INPUT'});
 try{
  const result=await supabase.auth.signInWithPassword({email:email.trim(),password});
  if(result.error)return Object.freeze({ok:false,code:'LOGIN_DENIED'});
  const assurance=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const factors=await supabase.auth.mfa.listFactors();
  const verified=factors?.data?.totp?.filter(x=>x.status==='verified')??[];
  if(assurance.error||factors.error||verified.length!==1){
   await supabase.auth.signOut();return Object.freeze({ok:false,code:'MFA_NOT_ENROLLED'});
  }
  if(assurance.data.currentLevel!=='aal2')
   return Object.freeze({ok:false,code:'MFA_REQUIRED',factorId:verified[0].id});
  const auth=await verifySupportAccess(supabase);
  if(!auth){await supabase.auth.signOut();return Object.freeze({ok:false,code:'SUPPORT_ROLE_REQUIRED'});}
  return Object.freeze({ok:true});
 }catch{return Object.freeze({ok:false,code:'LOGIN_UNAVAILABLE'});}
}
export async function supportTotpVerify(supabase,factorId,code){
 if(!UUID.test(factorId??'')||!/^[0-9]{6}$/.test(code??''))
  return Object.freeze({ok:false,code:'MFA_INPUT_INVALID'});
 try{
  const listed=await supabase.auth.mfa.listFactors();
  if(listed.error||!listed.data?.totp?.some(x=>x.id===factorId&&x.status==='verified'))
   return Object.freeze({ok:false,code:'MFA_FACTOR_NOT_VERIFIED'});
  const result=await supabase.auth.mfa.challengeAndVerify({factorId,code});
  if(result.error)return Object.freeze({ok:false,code:'MFA_DENIED'});
  const verified=await verifySupportAccess(supabase);
  if(!verified){await supabase.auth.signOut();return Object.freeze({ok:false,code:'SUPPORT_ROLE_REQUIRED'});}
  return Object.freeze({ok:true});
 }catch{return Object.freeze({ok:false,code:'MFA_UNAVAILABLE'});}
}
