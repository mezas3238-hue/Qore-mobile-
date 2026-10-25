/**
 * Real native Driver Auth only. Provider-issued JWT is verified online;
 * exact exclusive Driver role is retrieved from RLS user_roles. Neither
 * local JWT claims nor the phone decide KYC, offers, availability or LIVE.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
export function createNativeDriverAuth({supabase,now=Date.now}={}){
 if(!supabase||typeof now!=='function'
  ||typeof supabase.auth?.getSession!=='function'
  ||typeof supabase.auth?.getUser!=='function'
  ||typeof supabase.auth?.signInWithPassword!=='function'
  ||typeof supabase.auth?.signOut!=='function'
  ||typeof supabase.from!=='function')
  throw Error('Native Driver needs trusted Auth and RLS role authority');
 let busy=false;
 async function getSession(){
  const local=await supabase.auth.getSession();
  if(local.error)throw Error('Driver identity is unavailable');
  const session=local.data?.session;
  const token=session?.access_token;
  const expiresAt=Number(session?.expires_at)*1000;
  if(typeof token!=='string'||token.length<20||token.length>7900
   ||!Number.isSafeInteger(expiresAt)||expiresAt<=now()+1000)
   return null;
  const verified=await supabase.auth.getUser(token);
  const user=verified.data?.user;
  if(verified.error||!user||!UUID.test(user.id)
   ||user.id!==session.user?.id||user.is_anonymous===true
   ||!(typeof user.email_confirmed_at==='string'
    ||typeof user.phone_confirmed_at==='string'))return null;
  const roles=await supabase.from('user_roles').select('role')
   .eq('user_id',user.id).limit(3);
  if(roles.error||!Array.isArray(roles.data)||roles.data.length!==1
   ||roles.data[0]?.role!=='driver')return null;
  return Object.freeze({role:'driver',userId:user.id,accessToken:token});
 }
 async function signIn(email,password){
  if(busy)return fail('AUTH_BUSY');
  if(typeof email!=='string'||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
   ||email.length>254||typeof password!=='string'
   ||password.length<8||password.length>256)
   return fail('INVALID_CREDENTIALS');
  busy=true;
  try{
   const {error}=await supabase.auth.signInWithPassword({
    email:email.trim().toLowerCase(),password
   });
   if(error)return fail('INVALID_CREDENTIALS_OR_NETWORK');
   const identity=await getSession();
   if(!identity){
    await supabase.auth.signOut();
    return fail('DRIVER_ROLE_NOT_VERIFIED');
   }
   return Object.freeze({ok:true});
  }catch{return fail('AUTH_UNAVAILABLE');}
  finally{busy=false;}
 }
 async function signOut(){
  const {error}=await supabase.auth.signOut();
  if(error)throw Error('Driver remote logout not confirmed');
 }
 function subscribe(listener){
  if(typeof listener!=='function')throw Error('Driver Auth listener required');
  const subscription=supabase.auth.onAuthStateChange?.(()=>{
   try{listener();}catch{/* never block Auth state */} 
  });
  return ()=>subscription?.data?.subscription?.unsubscribe?.();
 }
 return Object.freeze({getSession,signIn,signOut,subscribe});
}
