/**
 * G261: verify real independent password sessions for the eight QORE QA slots.
 * Run ONLY on a trusted Node operator host against pinned Supabase STAGING.
 * Creates short-lived Auth sessions through password login, verifies them via
 * provider /user and G42 SQL, and locally revokes those sessions afterwards.
 * Never creates users, KYC, bookings, payments, approvals or LIVE trips.
 */
import {pathToFileURL} from 'node:url';
import {inspectEightActorQa,G254_QA_SLOTS} from './g254-eight-actor-qa-readonly-audit.mjs';
import {inspectStageSignup} from './staging-auth-policy-gate.mjs';

const REF='mrjzxftsdxzepzbcuids';
const ORIGIN='https://'+REF+'.supabase.co';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const EMAIL=/^[a-z0-9._+-]+@[a-z0-9.-]+\.invalid$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const fail=()=>new Error('G261 STAGING Auth/G42 session proof blocked; review provider sessions privately');
const privateHeaders=key=>({
 apikey:key,Accept:'application/json',
 ...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})
});
const timeout=()=>AbortSignal.timeout(10000);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

export function verifyQaManifest(manifest){
 if(!Array.isArray(manifest)||manifest.length!==8)throw fail();
 const uniqueEmails=new Set(),uniquePasswords=new Set();
 return manifest.map((actor,i)=>{
  const {slot,role}=G254_QA_SLOTS[i];
  if(!isObj(actor)||actor.slot!==slot||actor.role!==role||
     typeof actor.email!=='string'||!EMAIL.test(actor.email)||
     typeof actor.password!=='string'||actor.password.length<20||
     actor.password.length>128||uniqueEmails.has(actor.email.toLowerCase())||
     uniquePasswords.has(actor.password))throw fail();
  uniqueEmails.add(actor.email.toLowerCase());
  uniquePasswords.add(actor.password);
  return actor;
 });
}
async function readJson(fetcher,path,opts,allowedStatus=200){
 let response;
 try{
  response=await fetcher(ORIGIN+path,{redirect:'error',cache:'no-store',
   signal:timeout(),...opts});
  if(response?.status!==allowedStatus||response.redirected===true)throw fail();
  return await response.json();
 }catch{throw fail();}
}
async function rpcSession(fetcher,key,identity){
 const answer=await readJson(fetcher,
  '/rest/v1/rpc/mobility_stage_g42_session_active',{
   method:'POST',headers:{...privateHeaders(key),'Content-Type':'application/json'},
   body:JSON.stringify({_user:identity.id,_session:identity.sessionId,
    _iat_ms:identity.issuedAt})
  });
 if(typeof answer!=='boolean')throw fail();
 return answer;
}
function claimsFromProviderVerifiedJwt(jwt,providerUser,slot,now){
 if(typeof jwt!=='string'||jwt.length>8192||!JWT.test(jwt)||
    !isObj(providerUser)||providerUser.is_anonymous!==false||
    providerUser.app_metadata?.qore_stage_qa!==true||
    providerUser.app_metadata?.qore_qa_slot!==slot||
    !(typeof providerUser.email_confirmed_at==='string'||
      typeof providerUser.confirmed_at==='string'))throw fail();
 let claims;
 try{claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString('utf8'));}
 catch{throw fail();}
 if(!isObj(claims)||!UUID.test(claims.sub??'')||
  !UUID.test(claims.session_id??'')||providerUser.id!==claims.sub||
  claims.iss!==ORIGIN+'/auth/v1'||claims.role!=='authenticated'||
  !(claims.aud==='authenticated'||
    Array.isArray(claims.aud)&&claims.aud.length===1&&claims.aud[0]==='authenticated')||
  !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||
  claims.iat*1000>now()+60000||claims.exp*1000<=now()||
  claims.exp<=claims.iat)throw fail();
 return {id:claims.sub,sessionId:claims.session_id,issuedAt:claims.iat*1000,token:jwt};
}
async function logoutLocal(fetcher,publicKey,identity){
 try{
  const r=await fetcher(ORIGIN+'/auth/v1/logout?scope=local',{
   method:'POST',redirect:'error',cache:'no-store',signal:timeout(),
   headers:{apikey:publicKey,Authorization:'Bearer '+identity.token}
  });
  return r?.redirected!==true&&(r?.status===204||r?.status===200);
 }catch{return false;}
}

/**
 * Proof is deliberately ephemeral. A failed run can leave created sessions
 * if the network fails during cleanup; it never claims cleanup succeeded.
 * This is a provider-backed session test, NOT an E2E booking certificate.
 */
export async function verifyEightQaSessions({
 ref,environment,liveTripsEnabled,publicKey,serviceKey,manifest,
 fetcher=fetch,signupGate=inspectStageSignup,
 actorAudit=inspectEightActorQa,now=Date.now
}={}){
 if(ref!==REF||environment!=='staging'||liveTripsEnabled!==false||
    typeof fetcher!=='function'||typeof now!=='function'||typeof actorAudit!=='function')
  throw fail();
 const actors=verifyQaManifest(manifest);
 let prior;
 try{prior=await actorAudit({ref,environment,liveTripsEnabled:false,
  publicKey,serviceKey,fetcher,signupGate});}
 catch{throw fail();}
 if(prior?.qaAuthAccounts!==8||prior.exclusiveQaRoles!==8||
    prior.signupDisabled!==true||prior.projectPinned!==true)throw fail();
 const sessions=[];let positive=0,negative=0,revoked=0;
 try{
  for(const actor of actors){
   const signed=await readJson(fetcher,'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:publicKey,
     Accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify({email:actor.email,password:actor.password})
   });
   // Token is retained immediately for best-effort local cleanup on failure.
   if(signed?.token_type?.toLowerCase()!=='bearer'||!JWT.test(signed.access_token??''))
    throw fail();
   const pending={token:signed.access_token};
   sessions.push(pending);
   const userResult=await readJson(fetcher,'/auth/v1/user',{
    method:'GET',headers:{apikey:publicKey,
     Authorization:'Bearer '+signed.access_token,Accept:'application/json'}
   });
   const identity=claimsFromProviderVerifiedJwt(signed.access_token,
    userResult,actor.slot,now);
   Object.assign(pending,identity);
   if(!(await rpcSession(fetcher,serviceKey,identity)))throw fail();
   positive++;
  }
  const uniqueUsers=new Set(sessions.map(s=>s.id));
  const uniqueSessions=new Set(sessions.map(s=>s.sessionId));
  if(uniqueUsers.size!==8||uniqueSessions.size!==8)throw fail();
  // Negative test: a real session of actor B must NEVER authenticate actor A.
  if(await rpcSession(fetcher,serviceKey,{
   id:sessions[0].id,sessionId:sessions[1].sessionId,
   issuedAt:sessions[1].issuedAt
  }))throw fail();
  negative++;
 }finally{
  for(const session of sessions){
   const didLogout=await logoutLocal(fetcher,publicKey,session);
   if(didLogout&&session.id&&session.sessionId){
    try{
     const stillActive=await rpcSession(fetcher,serviceKey,session);
     if(stillActive===false)revoked++;
    }catch{/* unavailable cannot be certified */}
   }
  }
 }
 if(positive!==8||negative!==1||revoked!==8)throw fail();
 return Object.freeze({
  mode:'PROVIDER_AUTH_SESSION_ONLY',
  eightIndependentPasswordSessionsVerified:positive,
  crossIdentitySessionDenied:negative,
  verifiedLocallyRevokedSessions:revoked,
  externalJourneysCertified:0,commercialLaunchAllowed:false
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--verify'||
     process.env.QORE_QA_SESSION_VERIFY_APPROVED!=='CONFIRM_STAGING_ONLY'||
     process.env.LIVE_TRIPS_ENABLED!=='false')throw fail();
  const manifest=JSON.parse(process.env.QORE_QA_ACTORS_JSON??'');
  const result=await verifyEightQaSessions({
   ref:process.env.QORE_STAGING_PROJECT_REF,
   environment:process.env.QORE_MOBILITY_ENV,
   liveTripsEnabled:false,publicKey:process.env.QORE_STAGING_ANON_KEY,
   serviceKey:process.env.QORE_STAGING_SERVICE_ROLE_KEY,manifest
  });
  console.log(JSON.stringify(result));
 }catch{
  // Do not reveal email, password, JWT, session UUID or private key.
  console.error('G261 BLOCKED: Auth session verification failed; audit QA sessions privately');
  process.exitCode=1;
 }
}
