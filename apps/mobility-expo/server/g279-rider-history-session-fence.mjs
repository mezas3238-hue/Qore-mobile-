/**
 * G279: provider-backed session fence for private Passenger history.
 *
 * Supabase Auth getUser(token) establishes the JWT identity.  Untrusted
 * decoded claims are never sufficient: the same subject, G42 session id,
 * issuance time and active auth.sessions row must ALSO agree via a
 * service_role-only SQL RPC.  Missing authority fails closed.
 *
 * Never expose JWTs, credentials, session IDs or service keys in receipts.
 * STAGING-only; no LIVE trips, payments, user creation or public SQL grants.
 */
const REF='mrjzxftsdxzepzbcuids';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const fail=()=>new Error('G279 private Passenger session unavailable');
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function verifiedClaims(token,providerUser,now){
 let claims;
 try{
  if(typeof token!=='string'||token.length<80||token.length>8192||
     !JWT.test(token)||!plain(providerUser)||!UUID.test(providerUser.id??'')||
     providerUser.is_anonymous!==false||
     !(typeof providerUser.email_confirmed_at==='string'||
       typeof providerUser.phone_confirmed_at==='string'))throw fail();
  const payload=token.split('.')[1];
  if(payload.length>4096)throw fail();
  claims=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
 }catch{throw fail();}
 const at=now();
 if(!plain(claims)||!Number.isSafeInteger(at)||at<=0||
    !UUID.test(claims.sub??'')||!UUID.test(claims.session_id??'')||
    claims.sub!==providerUser.id||
    claims.iss!=='https://'+REF+'.supabase.co/auth/v1'||
    claims.role!=='authenticated'||
    !(claims.aud==='authenticated'||
      Array.isArray(claims.aud)&&claims.aud.length===1&&
       claims.aud[0]==='authenticated')||
    !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||
    !Number.isSafeInteger(claims.iat*1000)||
    claims.iat*1000>at+60000||
    claims.exp*1000<=at||claims.exp<=claims.iat)
  throw fail();
 return {userId:claims.sub,sessionId:claims.session_id,
  issuedAtMs:claims.iat*1000};
}

export function createG279RiderHistorySessionVerifier({
 projectRef,verifyProviderUser,readProviderSession,now=Date.now
}={}){
 if(projectRef!==REF||typeof verifyProviderUser!=='function'||
    typeof readProviderSession!=='function'||typeof now!=='function')
  throw fail();
 return async token=>{
  let user;
  try{
   // The identity must first be validated by Supabase Auth itself.
   user=await verifyProviderUser(token);
   const scope=verifiedClaims(token,user,now);
   // G42 reads real auth.sessions.  This is NEVER a JWT-only shortcut.
   const active=await readProviderSession(scope);
   if(active!==true)throw fail();
  }catch{throw fail();}
  return user;
 };
}
