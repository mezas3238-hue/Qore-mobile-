/**
 * G247 Provider-backed session adapter for isolated Supabase STAGING.
 *
 * Auth.getUser(bearer) is the independent signature/identity authority.
 * JWT claims are parsed ONLY AFTER the Auth provider validates the same
 * bearer; they are cross-checked with provider identity, NEVER trusted alone.
 * The G247 PostgreSQL RPC checks that auth.sessions still contains that
 * exact provider-issued session and that the associated user is confirmed.
 *
 * This is a read-only revocation preflight, NOT a standalone transaction
 * admission fence. SQL G42 lock_session MUST run inside the SAME DB
 * transaction as a subsequent sensitive mutation; do not call it here
 * and then falsely claim the lock persisted across HTTP/RPC calls.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SEGMENT=/^[A-Za-z0-9_-]+$/;
const tokenError=()=>Error('G247 provider session not verified');
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function checkedClaims(token,ref,now){
 if(typeof token!=='string'||token.length<60||token.length>8192)
  throw tokenError();
 const parts=token.split('.');
 if(parts.length!==3||parts.some(p=>!p||!SEGMENT.test(p))||
    parts[2].length<24)throw tokenError();
 let head,body;
 try{
  head=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  body=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
 }catch{throw tokenError();}
 if(!plain(head)||!plain(body)||!['HS256','RS256','ES256','EdDSA'].includes(head.alg)||
    body.iss!=='https://'+ref+'.supabase.co/auth/v1'||
    body.role!=='authenticated'||
    !(body.aud==='authenticated'||Array.isArray(body.aud)&&
       body.aud.length===1&&body.aud[0]==='authenticated')||
    !UUID.test(body.sub??'')||!UUID.test(body.session_id??'')||
    !Number.isSafeInteger(body.iat)||!Number.isSafeInteger(body.exp)||
    body.iat<=0||body.exp<=body.iat||
    body.iat*1000>now()+60000||body.exp*1000<=now()||
    body.iat*1000<0||body.exp*1000>8640000000000000)
  throw tokenError();
 return {id:body.sub.toLowerCase(),sessionId:body.session_id.toLowerCase(),
  tokenIatMs:body.iat*1000,expiresAtMs:body.exp*1000};
}
export function createQoreG247ProviderSessionTrust({
 projectRef,auth,db,now=Date.now,allowedByOwner=false,liveEnabled=false
}={}){
 if(!/^[a-z0-9]{20}$/.test(projectRef??'')||allowedByOwner!==true||
  liveEnabled!==false||typeof auth?.getUser!=='function'||
  typeof db?.rpc!=='function'||typeof now!=='function')
  throw Error('G247 requires authorized STAGING and independent Auth/SQL providers');
 const verifySql=async user=>{
  try{
   const {data,error}=await db.rpc('mobility_stage_g42_session_active',{
    _user:user.id,_session:user.sessionId,_iat_ms:user.tokenIatMs
   });
   return !error&&data===true;
  }catch{return false;}
 };
 return Object.freeze({
  verifyParticipantSession:async token=>{
   const claims=checkedClaims(token,projectRef,now);
   let provider;
   try{
    const {data,error}=await auth.getUser(token);
    if(error)throw tokenError();
    provider=data?.user;
   }catch{throw tokenError();}
   if(!plain(provider)||provider.id?.toLowerCase()!==claims.id||
      provider.is_anonymous!==false||
      !(typeof provider.email_confirmed_at==='string'||
        typeof provider.phone_confirmed_at==='string')||
      !(await verifySql(claims)))throw tokenError();
   return Object.freeze({...claims,is_anonymous:false});
  },
  verifySessionNotRevoked:async({userId,sessionId,tokenIatMs}={})=>{
   if(!UUID.test(userId??'')||!UUID.test(sessionId??'')||
      !Number.isSafeInteger(tokenIatMs)||tokenIatMs<=0)
    return false;
   return verifySql({id:userId.toLowerCase(),sessionId:sessionId.toLowerCase(),
    tokenIatMs});
  }
 });
}
