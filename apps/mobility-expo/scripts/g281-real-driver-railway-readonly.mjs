/**
 * G281: REAL, read-only Driver QA Auth -> Railway -> Supabase bridge.
 * No uploaded documents, enrollment, KYC approvals, GPS, offers or money.
 * Run only on the authorized private operator host with the original manifest.
 * Never prints names, UUIDs, emails, JWTs, passwords or response bodies.
 */
import {pathToFileURL} from 'node:url';
import {verifyManifest,STAGING_REF} from './qore-staging-qa-identity-bootstrap.mjs';
import {assertPublishableKey,inspectStageSignup} from './staging-auth-policy-gate.mjs';

const PROVIDER='https://'+STAGING_REF+'.supabase.co';
const RAILWAY='https://qore-mobile-backend-staging-staging.up.railway.app';
const DOCS='/v1/staging/driver/documents';
const LICENSE='/v1/staging/driver/license-readiness';
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const deny=code=>Object.freeze({ok:false,mode:'G281_DRIVER_READONLY_BRIDGE',
 code,externalJourneysCertified:0,commercialEnabled:false});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=x=>Object.keys(x).sort();
async function call(request,url,{method='GET',key,token,body}={}){
 const headers={Accept:'application/json'};
 if(key)headers.apikey=key;
 if(token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await request(url,{method,redirect:'error',cache:'no-store',
  credentials:'omit',referrerPolicy:'no-referrer',
  signal:AbortSignal.timeout(10000),headers,
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response||response.redirected===true||!Number.isInteger(response.status))
  throw Error('remote status not certified');
 return response;
}
async function readJson(response){
 if(!/^application\/json(?:\s*;|$)/i.test(
    response.headers?.get?.('content-type')??''))
  throw Error('invalid media type');
 const length=response.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>8192))
  throw Error('untrusted response length');
 const reader=response.body?.getReader?.();
 if(!reader)throw Error('bounded response required');
 const parts=[];let size=0,ended=false;
 try{
  for(;;){
   const chunk=await reader.read();
   if(chunk.done){ended=true;break;}
   if(!(chunk.value instanceof Uint8Array))throw Error('untrusted bytes');
   size+=chunk.value.length;
   if(size>8192)throw Error('untrusted response too large');
   parts.push(chunk.value);
  }
 }finally{if(!ended)await reader.cancel().catch(()=>{});}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
  Buffer.concat(parts,size)));
}
async function login(request,key,actor,remember){
 const response=await call(request,PROVIDER+'/auth/v1/token?grant_type=password',
  {method:'POST',key,body:{email:actor.email,password:actor.password}});
 if(response.status!==200)throw Error('Provider Auth rejected');
 const signed=await readJson(response);
 if(!obj(signed)||signed.token_type?.toLowerCase()!=='bearer'||
  typeof signed.access_token!=='string'||signed.access_token.length>8192||
  !JWT.test(signed.access_token))throw Error('Untrusted token');
 const token=signed.access_token;
 remember(token);
 const userResponse=await call(request,PROVIDER+'/auth/v1/user',{key,token});
 if(userResponse.status!==200)throw Error('Provider user not confirmed');
 const user=await readJson(userResponse);
 if(!obj(user)||!UUID.test(user.id??'')||user.is_anonymous!==false||
   user.app_metadata?.qore_stage_qa!==true||
   user.app_metadata?.qore_qa_slot!==actor.slot||
   user.email?.toLowerCase()!==actor.email.toLowerCase()||
   !(typeof user.email_confirmed_at==='string'||
     typeof user.confirmed_at==='string'))
  throw Error('Provider slot mismatch');
 return user.id;
}
async function logout(request,key,token){
 try{
  const response=await call(request,PROVIDER+'/auth/v1/logout?scope=local',
   {method:'POST',key,token});
  return response.status===200||response.status===204;
 }catch{return false;}
}
async function get(request,path,token){
 return call(request,RAILWAY+path,{token});
}

export async function verifyG281DriverReadOnly({
 ref,environment,liveTripsEnabled,publicKey,manifest,request=fetch,
 signupGate=inspectStageSignup
}={}){
 if(ref!==STAGING_REF||environment!=='staging'||liveTripsEnabled!=='false'||
   typeof request!=='function'||typeof signupGate!=='function')
  return deny('STAGING_ONLY_REQUIRED');
 let actors;
 try{assertPublishableKey(publicKey,ref);actors=verifyManifest(manifest);}
 catch{return deny('PRIVATE_QA_MANIFEST_INVALID');}
 const sessions=[];let outcome=deny('DRIVER_PROVIDER_OR_RAILWAY_UNAVAILABLE');
 let logoutVerified=true;
 try{
  const signup=await signupGate({ref,key:publicKey,request});
  if(signup?.certified!==true)throw Error('public signup not locked');
  if((await get(request,DOCS,null)).status!==401||
     (await get(request,LICENSE,null)).status!==401){
   outcome=deny('ANONYMOUS_DRIVER_ACCESS_NOT_DENIED');
  }else{
   for(const slot of ['driver_auto','passenger']){
    const actor=actors.find(a=>a.slot===slot);
    if(!actor)throw Error('Missing actor');
    const session={slot,token:null,id:null};
    session.id=await login(request,publicKey,actor,token=>{
      session.token=token;sessions.push(session);
    });
   }
   if(sessions[0].id===sessions[1].id)throw Error('Same actor for both roles');
   const docResponse=await get(request,DOCS,sessions[0].token);
   const docBody=docResponse.status===200?await readJson(docResponse):null;
   const licenseResponse=await get(request,LICENSE,sessions[0].token);
   const licenseBody=licenseResponse.status===200?await readJson(licenseResponse):null;
   if(docResponse.status!==200||!obj(docBody)||
      keys(docBody).join('|')!=='documents|liveOperationsEnabled|mode'||
      docBody.mode!=='STAGING_DEMO_ONLY'||docBody.liveOperationsEnabled!==false||
      !Array.isArray(docBody.documents)||docBody.documents.length!==0||
      licenseResponse.status!==200||!obj(licenseBody)||
      licenseBody.mode!=='STAGING_DEMO_ONLY'||
      licenseBody.currentLicenseApproved!==false||
      licenseBody.driverEligible!==false||
      licenseBody.liveOperationsEnabled!==false||
      licenseBody.verificationScope!=='CURRENT_LICENSE_REVIEW_ONLY'){
    outcome=deny('DRIVER_EMPTY_KYC_READ_NOT_VERIFIED');
   }else if((await get(request,DOCS,sessions[1].token)).status!==403||
      (await get(request,LICENSE,sessions[1].token)).status!==403){
    outcome=deny('PASSENGER_CROSSED_DRIVER_BOUNDARY');
   }else{
    outcome=Object.freeze({ok:true,mode:'G281_DRIVER_READONLY_BRIDGE',
     realSessionsVerified:2,driverDocumentsEmpty:true,
     licenseApprovalDenied:true,passengerAccessDenied:2,
     revocationVerified:false,externalJourneysCertified:0,
     commercialEnabled:false});
   }
  }
 }catch{outcome=deny('DRIVER_PROVIDER_OR_RAILWAY_UNAVAILABLE');}
 finally{
  for(const s of sessions){
   if(!await logout(request,publicKey,s.token))logoutVerified=false;
  }
 }
 if(!logoutVerified)return deny('QA_SESSION_CLEANUP_UNVERIFIED');
 if(outcome.ok!==true)return outcome;
 try{
  if((await get(request,DOCS,sessions[0].token)).status!==401||
     (await get(request,LICENSE,sessions[0].token)).status!==401)
   return deny('REVOKED_DRIVER_TOKEN_STILL_ACCEPTED');
 }catch{return deny('REVOKED_DRIVER_DENIAL_UNVERIFIED');}
 return Object.freeze({...outcome,revocationVerified:true});
}
/**
 * Safe operator diagnostics. Return only constant codes, never values, paths,
 * identities, credentials, tokens or private manifest contents.
 * A Codespaces terminal restart often drops its exported environment.
 */
export function g281OperatorPreflight(env={},argv=[]){
 if(argv.length!==3||argv[2]!=='--verify')return 'G281_VERIFY_ONLY_REQUIRED';
 if(env.CI==='true'||env.GITHUB_ACTIONS==='true'||
   typeof env.RAILWAY_ENVIRONMENT==='string')
  return 'G281_PRIVATE_OPERATOR_HOST_REQUIRED';
 if(env.QORE_QA_DRIVER_READONLY_APPROVED!=='CONFIRM_READ_ONLY_STAGING')
  return 'G281_EXPLICIT_READONLY_APPROVAL_MISSING';
 if(env.QORE_QA_ACTORS_JSON!==undefined)
  return 'G281_INLINE_CREDENTIALS_FORBIDDEN';
 if(typeof env.QORE_QA_MANIFEST_FILE!=='string'||
    env.QORE_QA_MANIFEST_FILE.length===0)
  return 'G281_PRIVATE_MANIFEST_PATH_MISSING';
 if(env.QORE_STAGING_PROJECT_REF!==STAGING_REF)
  return 'G281_STAGING_PROJECT_REF_MISSING_OR_DIFFERENT';
 if(env.QORE_MOBILITY_ENV!=='staging')
  return 'G281_STAGING_ENVIRONMENT_REQUIRED';
 if(env.LIVE_TRIPS_ENABLED!=='false')
  return 'G281_LIVE_TRIPS_MUST_BE_DISABLED';
 try{assertPublishableKey(env.QORE_STAGING_ANON_KEY,STAGING_REF);}
 catch{return 'G281_PUBLIC_KEY_MISSING_OR_INVALID';}
 return null;
}

const main=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(main){
 const diagnostic=g281OperatorPreflight(process.env,process.argv);
 if(diagnostic){
  console.error(diagnostic);
  process.exitCode=1;
 }else{
  let manifest;
  try{
   const {readPrivateQaManifest}=await import('./g263-private-qa-manifest.mjs');
   manifest=await readPrivateQaManifest(process.env.QORE_QA_MANIFEST_FILE);
  }catch{
   // Deliberately no filename, raw parse exception or credential disclosure.
   console.error('G281_PRIVATE_MANIFEST_UNREADABLE_OR_INVALID');
   process.exitCode=1;
  }
  if(manifest){
   try{
    const result=await verifyG281DriverReadOnly({
     ref:process.env.QORE_STAGING_PROJECT_REF,
     environment:process.env.QORE_MOBILITY_ENV,
     liveTripsEnabled:process.env.LIVE_TRIPS_ENABLED,
     publicKey:process.env.QORE_STAGING_ANON_KEY,manifest
    });
    console.log(JSON.stringify(result));
    if(!result.ok)process.exitCode=1;
   }catch{
    console.error('G281_PRIVATE_DRIVER_BRIDGE_RUNTIME_FAILURE');
    process.exitCode=1;
   }
  }
 }
}
