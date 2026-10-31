/**
 * G256: Railway STAGING pre-deploy verification. Safe for CI: no writes, no
 * Auth signup, no database migrations, no secret values in diagnostics.
 *
 * Invoked independently before first external STAGING launch. A process-up
 * health probe cannot certify any of five external E2E journeys.
 */
import {fileURLToPath} from 'node:url';
import {inspectStageSignup,safeStageRef,assertPublishableKey}
 from './staging-auth-policy-gate.mjs';
const TARGET_REF='mrjzxftsdxzepzbcuids';
const DOMAIN=/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.up\.railway\.app$/;
const key64=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{43,256}$/.test(x)
 &&new Set(x).size>=12;
function serverRole(x,ref){
 if(typeof x!=='string'||x.length<25||/\s/.test(x))return false;
 if(/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(x))return true;
 const parts=x.split('.');
 if(parts.length!==3)return false;
 try{
  const c=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  return c?.role==='service_role'&&(!c.ref||c.ref===ref);
 }catch{return false;}
}
const denied=reason=>Object.freeze({ok:false,code:reason,stageOnly:true,
 commercialRidesEnabled:false});

/**
 * Independently prove a backend-only credential can read the pinned
 * Supabase Auth Admin endpoint. This GET never creates an identity and
 * deliberately returns only a boolean, not user data or credentials.
 * New sb_secret_* keys travel only in apikey (they are not JWTs).
 */
export async function checkStageServerCredential({
 ref,key,request=fetch
}={}){
 if(ref!==TARGET_REF||!serverRole(key,ref)||typeof request!=='function')
  return Object.freeze({certified:false});
 try{
  const response=await request(
   'https://'+TARGET_REF+'.supabase.co/auth/v1/admin/users?per_page=1&page=1',{
    method:'GET',redirect:'error',cache:'no-store',
    signal:AbortSignal.timeout(10000),
    headers:{
     apikey:key,Accept:'application/json',
     ...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})
    }
   });
  if(response?.ok!==true||response.status!==200)
   return Object.freeze({certified:false});
  const body=await response.json();
  return Object.freeze({certified:Array.isArray(body?.users)});
 }catch{return Object.freeze({certified:false});}
}
export async function verifyG256RailwayLaunch({
 env={},checkSignup=inspectStageSignup,
 checkServerCredential=checkStageServerCredential
}={}){
 if(typeof checkSignup!=='function'||typeof checkServerCredential!=='function')
  return denied('INVALID_PREFLIGHT_ADAPTER');
 if(env.QORE_MOBILITY_ENV!=='staging'||
  env.RAILWAY_ENVIRONMENT_NAME?.toLowerCase()!=='staging'||
  env.LIVE_TRIPS_ENABLED!=='false'||
  env.QORE_RAILWAY_NO_COMMERCIAL_TRIPS!=='true'||
  env.QORE_RAILWAY_STAGING_APPROVED!=='true')
  return denied('STAGING_OWNER_GATE_OFF');
 if(env.QORE_STAGING_PROJECT_REF!==TARGET_REF||
  !DOMAIN.test(env.QORE_RAILWAY_HOSTNAME??'')||
  (env.RAILWAY_PUBLIC_DOMAIN&&
   env.RAILWAY_PUBLIC_DOMAIN!==env.QORE_RAILWAY_HOSTNAME)||
  !Number.isInteger(Number(env.PORT))||
  Number(env.PORT)<1024||Number(env.PORT)>65535)
  return denied('WRONG_STAGING_DESTINATION');
 try{
  safeStageRef(env.QORE_STAGING_PROJECT_REF);
  assertPublishableKey(env.QORE_STAGING_PUBLISHABLE_KEY,TARGET_REF);
 }catch{return denied('INVALID_PUBLIC_SUPABASE_KEY');}
 if(!serverRole(env.QORE_STAGING_SERVICE_ROLE_KEY,TARGET_REF)||
  env.QORE_STAGING_SERVICE_ROLE_KEY===env.QORE_STAGING_PUBLISHABLE_KEY)
  return denied('SERVER_SECRET_NOT_CONFIGURED');
 if(!key64(env.QORE_HISTORY_CURSOR_SIGNING_KEY)||
  env.QORE_HISTORY_CURSOR_SIGNING_KEY===env.QORE_STAGING_SERVICE_ROLE_KEY||
  env.QORE_HISTORY_CURSOR_SIGNING_KEY===env.QORE_STAGING_PUBLISHABLE_KEY||
  (env.QORE_HISTORY_CURSOR_PREVIOUS_KEY!==undefined&&
   (!key64(env.QORE_HISTORY_CURSOR_PREVIOUS_KEY)||
    env.QORE_HISTORY_CURSOR_PREVIOUS_KEY===env.QORE_HISTORY_CURSOR_SIGNING_KEY)))
  return denied('CURSOR_SIGNING_SECRET_NOT_CONFIGURED');
 let policy;
 try{
  policy=await checkSignup({ref:TARGET_REF,
   key:env.QORE_STAGING_PUBLISHABLE_KEY});
 }catch{return denied('SUPABASE_AUTH_STATUS_UNVERIFIED');}
 if(policy?.certified!==true)
  return denied('PUBLIC_SIGNUP_NOT_CERTIFIED_CLOSED');
 let backend;
 try{backend=await checkServerCredential({
  ref:TARGET_REF,key:env.QORE_STAGING_SERVICE_ROLE_KEY
 });}catch{return denied('SUPABASE_SERVER_AUTH_UNVERIFIED');}
 if(backend?.certified!==true)
  return denied('SUPABASE_SERVER_AUTH_UNVERIFIED');
 return Object.freeze({ok:true,code:'STAGING_PREDEPLOY_GATES_PASS',
  projectRef:TARGET_REF,stageOnly:true,commercialRidesEnabled:false,
  fiveExternalJourneysCertified:false});
}
const invoked=process.argv[1]&&
 fileURLToPath(import.meta.url)===process.argv[1];
if(invoked){
 const status=await verifyG256RailwayLaunch({env:process.env});
 if(status.ok)console.log('G256 STAGING predeploy PASS; does not certify external journeys');
 else{console.error('G256 BLOCKED: '+status.code);process.exitCode=1;}
}
