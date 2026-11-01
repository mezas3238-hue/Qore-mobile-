/**
 * G278: AUTHENTICATED external STAGING bridge proof, without business writes.
 * Operator-only: 3 real QA passwords => Supabase Auth => Railway own history.
 * Explicit fail-closed checks for cross-role access and a revoked session.
 * Never prints emails, IDs, passwords, JWTs or response bodies.
 * NOT a five-journey E2E certificate, driver KYC or production readiness.
 */
import {pathToFileURL} from 'node:url';
import {verifyManifest,STAGING_REF} from './qore-staging-qa-identity-bootstrap.mjs';
import {assertPublishableKey,inspectStageSignup} from './staging-auth-policy-gate.mjs';

const ORIGIN='https://qore-mobile-backend-staging-staging.up.railway.app';
const PROVIDER='https://'+STAGING_REF+'.supabase.co';
const HISTORY='/v1/staging/rider/history';
const SLOTS=['passenger','driver_auto','owner_admin'];
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const safe=(code)=>Object.freeze({ok:false,mode:'STAGING_AUTH_BRIDGE_READONLY',
 code,externalJourneysCertified:0,commercialEnabled:false});
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const headers=key=>({apikey:key,Accept:'application/json'});
function timeout(){return AbortSignal.timeout(10000);}
async function call(request,url,method,head,body){
 const response=await request(url,{method,redirect:'error',cache:'no-store',
  credentials:'omit',referrerPolicy:'no-referrer',signal:timeout(),
  headers:head,...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response||response.redirected===true||
    !Number.isInteger(response.status))throw Error('provider response missing');
 return response;
}
async function json(response){
 if(!/^application\/json(?:\s*;|$)/i.test(
   response.headers?.get?.('content-type')??''))throw Error('invalid JSON media type');
 const n=response.headers?.get?.('content-length');
 if(n!=null&&(!/^\d+$/.test(n)||Number(n)>8192))
  throw Error('response exceeds private boundary');
 const reader=response.body?.getReader?.();
 if(!reader)throw Error('bounded response required');
 const chunks=[];let bytes=0,ended=false;
 try{
  for(;;){
   const part=await reader.read();
   if(part.done){ended=true;break;}
   if(!(part.value instanceof Uint8Array))throw Error('invalid byte stream');
   bytes+=part.value.length;
   if(bytes>8192)throw Error('response too large');
   chunks.push(part.value);
  }
 }finally{if(!ended)await reader.cancel().catch(()=>{});}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
  Buffer.concat(chunks,bytes)));
}
async function providerLogin(request,key,actor){
 const login=await call(request,PROVIDER+'/auth/v1/token?grant_type=password',
  'POST',{...headers(key),'Content-Type':'application/json'},
  {email:actor.email,password:actor.password});
 if(login.status!==200)throw Error('password login denied');
 const r=await json(login);
 if(!isObj(r)||r.token_type?.toLowerCase()!=='bearer'||
    typeof r.access_token!=='string'||r.access_token.length>8192||
    !JWT.test(r.access_token))throw Error('untrusted login receipt');
 const token=r.access_token;
 const u=await call(request,PROVIDER+'/auth/v1/user','GET',
  {...headers(key),Authorization:'Bearer '+token});
 if(u.status!==200)throw Error('provider user denied');
 const user=await json(u);
 if(!isObj(user)||!UUID.test(user.id??'')||user.is_anonymous!==false||
    user.app_metadata?.qore_stage_qa!==true||
    user.app_metadata?.qore_qa_slot!==actor.slot||
    user.email?.toLowerCase()!==actor.email.toLowerCase()||
    !(typeof user.email_confirmed_at==='string'||
      typeof user.confirmed_at==='string'))throw Error('provider identity mismatch');
 return {token,userId:user.id};
}
async function gateway(request,token){
 return call(request,ORIGIN+HISTORY,'GET',{
  Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{})
 });
}
async function logout(request,key,token){
 try{
  const r=await call(request,PROVIDER+'/auth/v1/logout?scope=local','POST',
   {apikey:key,Authorization:'Bearer '+token});
  return r.status===204||r.status===200;
 }catch{return false;}
}
export async function verifyG278RealQaRailway({
 ref,environment,liveTripsEnabled,publicKey,manifest,
 request=fetch,signupGate=inspectStageSignup
}={}){
 // Validate before any network access; no arbitrary origin/role/secret accepted.
 if(ref!==STAGING_REF||environment!=='staging'||liveTripsEnabled!=='false'||
    typeof request!=='function'||typeof signupGate!=='function')
  return safe('STAGING_ONLY_REQUIRED');
 let actors;
 try{
  assertPublishableKey(publicKey,ref);
  actors=verifyManifest(manifest);
 }catch{return safe('QA_MANIFEST_OR_PUBLIC_KEY_INVALID');}
 const sessions=[];let result=safe('PROVIDER_OR_RAILWAY_UNAVAILABLE');
 let cleanupVerified=true;
 try{
  const policy=await signupGate({ref,key:publicKey,request});
  if(policy?.certified!==true)throw Error('public signup must remain disabled');
  const noBearer=await gateway(request,null);
  if(noBearer.status!==401){result=safe('ANONYMOUS_HISTORY_NOT_DENIED');}
  else{
   for(const slot of SLOTS){
    const actor=actors.find(x=>x.slot===slot);
    if(!actor)throw Error('missing QA slot');
    // Retain the JWT immediately to revoke it even if later checks fail.
    const identity=await providerLogin(request,publicKey,actor);
    sessions.push({slot,...identity});
   }
   if(new Set(sessions.map(x=>x.userId)).size!==3)
    throw Error('QA identity aliasing');
   const passenger=await gateway(request,sessions[0].token);
   const own=passenger.status===200?await json(passenger):null;
   if(passenger.status!==200||!isObj(own)||own.ownerId!==sessions[0].userId||
      !Array.isArray(own.items)||own.items.length!==0||own.nextCursor!==null){
    result=safe('PASSENGER_PRIVATE_HISTORY_NOT_VERIFIED');
   }else{
    const driver=await gateway(request,sessions[1].token);
    const owner=await gateway(request,sessions[2].token);
    if(driver.status!==403||owner.status!==403)
     result=safe('CROSS_ROLE_HISTORY_NOT_DENIED');
    else result=Object.freeze({
     ok:true,mode:'STAGING_AUTH_BRIDGE_READONLY',
     providerSessionsVerified:3,privatePassengerHistoryVerified:true,
     nonPassengerAccessDenied:2,revocationVerified:false,
     externalJourneysCertified:0,commercialEnabled:false
    });
   }
  }
 }catch{result=safe('PROVIDER_OR_RAILWAY_UNAVAILABLE');}
 finally{
  for(const s of sessions){
   if(!await logout(request,publicKey,s.token))cleanupVerified=false;
  }
 }
 if(!cleanupVerified)return safe('AUTH_SESSION_LOGOUT_UNVERIFIED');
 if(result.ok!==true)return result;
 try{
  const replay=await gateway(request,sessions[0].token);
  if(replay.status!==401)return safe('REVOKED_PASSENGER_SESSION_STILL_READABLE');
 }catch{return safe('REVOKED_SESSION_DENIAL_NOT_VERIFIED');}
 return Object.freeze({...result,revocationVerified:true});
}
const invoked=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(invoked){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--verify'||
   process.env.CI==='true'||process.env.GITHUB_ACTIONS==='true'||
   typeof process.env.RAILWAY_ENVIRONMENT==='string'||
   process.env.QORE_QA_AUTH_BRIDGE_APPROVED!=='CONFIRM_READ_ONLY_STAGING')
   throw Error('operator opt-in required');
  if(!process.env.QORE_QA_MANIFEST_FILE||process.env.QORE_QA_ACTORS_JSON)
   throw Error('private manifest required');
  const {readPrivateQaManifest}=await import('./g263-private-qa-manifest.mjs');
  const manifest=await readPrivateQaManifest(process.env.QORE_QA_MANIFEST_FILE);
  const out=await verifyG278RealQaRailway({
   ref:process.env.QORE_STAGING_PROJECT_REF,
   environment:process.env.QORE_MOBILITY_ENV,
   liveTripsEnabled:process.env.LIVE_TRIPS_ENABLED,
   publicKey:process.env.QORE_STAGING_ANON_KEY,manifest
  });
  console.log(JSON.stringify(out));
  if(!out.ok)process.exitCode=1;
 }catch{
  console.error('G278 BLOCKED: inspect STAGING Auth / Railway independently');
  process.exitCode=1;
 }
}
