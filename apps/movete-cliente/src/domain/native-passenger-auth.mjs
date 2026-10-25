/**
 * Native Passenger Auth (B). Supabase Auth verifies the JWT online; RLS
 * returns the entire role set for this user. Neither device metadata nor a
 * locally decoded JWT can confer the Passenger role. Never persists passwords.
 *
 * Session persistence is owned by the client factory (SecureStore on devices).
 * This adapter is the ONLY identity source for ClientExperience.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
const validEmail=x=>typeof x==='string'&&x.length>=5&&x.length<=254
 &&x===x.trim()&&!/\s/.test(x)&&/^[^@]+@[^@]+\.[^@]+$/.test(x);
const confirmed=user=>typeof user?.email_confirmed_at==='string'
 ||typeof user?.phone_confirmed_at==='string';
export function createNativePassengerAuth({supabase,now=()=>Date.now()}={}){
 if(!supabase||typeof supabase.auth?.getSession!=='function'
  ||typeof supabase.auth?.getUser!=='function'
  ||typeof supabase.auth?.signInWithPassword!=='function'
  ||typeof supabase.auth?.signOut!=='function'
  ||typeof supabase.from!=='function'||typeof now!=='function')
  throw Error('Supabase Auth and RLS role authority are required');
 let mutationBusy=false;
 async function readSession(){
  const local=await supabase.auth.getSession();
  if(local.error)throw Error('AUTH_UNAVAILABLE');
  const session=local.data?.session;
  const access=session?.access_token;
  if(typeof access!=='string'||access.length<20||access.length>7900)return null;
  const expiry=Number(session.expires_at)*1000;
  if(!Number.isSafeInteger(expiry)||expiry<=now()+1000)return null;
  // getSession alone is not a proof. Check provider Auth over network.
  const verified=await supabase.auth.getUser(access);
  const user=verified.data?.user;
  if(verified.error||!user||!UUID.test(user.id)
   ||user.is_anonymous===true||!confirmed(user)
   ||session.user?.id!==user.id)return null;
  // Query all the roles, not merely .eq('role','passenger') which could
  // hide a second privileged role. Database RLS must scope the list.
  const {data:roles,error}=await supabase.from('user_roles')
   .select('role').eq('user_id',user.id).limit(3);
  if(error||!Array.isArray(roles)||roles.length!==1||
   roles[0]?.role!=='passenger')return null;
  return Object.freeze({role:'passenger',subject:user.id,
   token:access,expiresAt:expiry});
 }
 async function signIn(email,password){
  if(mutationBusy)return fail('AUTH_OPERATION_BUSY');
  if(!validEmail(email)||typeof password!=='string'
   ||password.length<8||password.length>256)
   return fail('INVALID_LOGIN_INPUT');
  mutationBusy=true;
  try{
   const {error}=await supabase.auth.signInWithPassword({
    email:email.toLowerCase(),password
   });
   if(error)return fail('INVALID_CREDENTIALS_OR_UNAVAILABLE');
   const verified=await readSession();
   if(!verified){
    // A valid Auth identity is not necessarily an authorized Passenger.
    // Revoke sign-in before exposing Passenger-only ClientExperience.
    await supabase.auth.signOut();
    return fail('PASSENGER_ROLE_NOT_VERIFIED');
   }
   return Object.freeze({ok:true,subject:verified.subject});
  }catch{
   return fail('AUTH_UNAVAILABLE');
  }finally{mutationBusy=false;}
 }
 async function signOut(){
  // The calling ClientExperience must purge private state immediately.
  const {error}=await supabase.auth.signOut();
  if(error)throw Error('SERVER_REVOCATION_UNCONFIRMED');
 }
 return Object.freeze({readSession,signIn,signOut});
}
