/**
 * G254: post-G251 read-only evidence of eight real Supabase STAGING QA actors.
 * Audit only: no sign-in, user creation, password verification, trip,
 * transaction, PSP, dispatch, deploy, or promotion to production.
 */
import {pathToFileURL} from 'node:url';
import {inspectStageSignup,assertPublishableKey} from './staging-auth-policy-gate.mjs';

export const G254_STAGING_REF='mrjzxftsdxzepzbcuids';
export const G254_QA_SLOTS=Object.freeze([
 ['owner_admin','admin'],['passenger','passenger'],
 ['driver_auto','driver'],['driver_moto','driver'],
 ['parcel_sender','passenger'],['courier_auto','driver'],
 ['courier_moto','driver'],['merchant_owner','passenger']
].map(([slot,role])=>Object.freeze({slot,role})));
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const QA_EMAIL=/^[a-z0-9._+-]+@[a-z0-9.-]+\.invalid$/i;
const b64=/^[A-Za-z0-9_-]+$/;
const fail=()=>Error('G254 STAGING independent Auth/role evidence unavailable');
function assertSecret(secret){
 if(typeof secret!=='string'||secret.length<30||/\s/.test(secret))throw fail();
 if(/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(secret))return;
 const parts=secret.split('.');
 if(parts.length!==3||parts.some(v=>!b64.test(v)))throw fail();
 try{
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(claims?.role!=='service_role'||claims?.ref!==G254_STAGING_REF)
   throw fail();
 }catch{throw fail();}
}
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
async function getJson(fetcher,url,key){
 let resp;
 try{
  resp=await fetcher(url,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'}
  });
  if(resp?.ok!==true||resp.status!==200)throw fail();
  return await resp.json();
 }catch{throw fail();}
}
export async function inspectEightActorQa({
 ref,environment,liveTripsEnabled,publicKey,serviceKey,
 fetcher=fetch,signupGate=inspectStageSignup
}={}){
 if(ref!==G254_STAGING_REF||environment!=='staging'||
    liveTripsEnabled!==false||typeof fetcher!=='function'||
    typeof signupGate!=='function')throw fail();
 assertPublishableKey(publicKey,ref);
 assertSecret(serviceKey);
 if(serviceKey===publicKey)throw fail();

 // Public signup must be disabled independently before privileged introspection.
 let policy;
 try{policy=await signupGate({ref,key:publicKey,request:fetcher});}
 catch{throw fail();}
 if(policy?.certified!==true)throw fail();

 const root='https://'+ref+'.supabase.co';
 const usersResponse=await getJson(fetcher,
  root+'/auth/v1/admin/users?per_page=50&page=1',serviceKey);
 if(!plain(usersResponse)||!Array.isArray(usersResponse.users)||
    usersResponse.users.length!==8)throw fail();

 const found=new Map(),ids=new Set(),emails=new Set();
 const allowed=new Map(G254_QA_SLOTS.map(({slot,role})=>[slot,role]));
 for(const user of usersResponse.users){
  if(!plain(user)||!UUID.test(user.id??'')||
     !QA_EMAIL.test(user.email??'')||user.is_anonymous!==false||
     (typeof user.email_confirmed_at!=='string'&&
      typeof user.confirmed_at!=='string')||
     user.app_metadata?.qore_stage_qa!==true||
     typeof user.app_metadata?.qore_qa_slot!=='string')
   throw fail();
  const slot=user.app_metadata.qore_qa_slot;
  if(!allowed.has(slot)||found.has(slot)||ids.has(user.id)||
     emails.has(user.email.toLowerCase()))throw fail();
  found.set(slot,{id:user.id,role:allowed.get(slot)});
  ids.add(user.id);emails.add(user.email.toLowerCase());
 }
 if(found.size!==8)throw fail();

 const rolesResponse=await getJson(fetcher,
  root+'/rest/v1/user_roles?select=user_id,role',serviceKey);
 if(!Array.isArray(rolesResponse)||rolesResponse.length!==8)throw fail();
 const roleMap=new Map();
 for(const row of rolesResponse){
  if(!plain(row)||!UUID.test(row.user_id??'')||
     !ids.has(row.user_id)||roleMap.has(row.user_id)||
     !['admin','passenger','driver'].includes(row.role))
   throw fail();
  roleMap.set(row.user_id,row.role);
 }
 for(const {id,role} of found.values())
  if(roleMap.get(id)!==role)throw fail();

 // This evidence proves registration and exclusive roles ONLY.
 // No password-based login, independent JWT, G42 session, KYC, GPS,
 // merchant approval, paid infrastructure or external E2E was performed.
 return Object.freeze({
  mode:'STAGING_READ_ONLY',
  projectPinned:true,
  signupDisabled:true,
  qaAuthAccounts:8,
  exclusiveQaRoles:8,
  roleCounts:Object.freeze({admin:1,driver:4,passenger:3}),
  verifiedPasswordLogin:false,
  verifiedG42Sessions:0,
  externalJourneysCertified:0,
  commercialLaunchAllowed:false
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--audit'||
     process.env.LIVE_TRIPS_ENABLED!=='false')throw fail();
  const report=await inspectEightActorQa({
   ref:process.env.QORE_STAGING_PROJECT_REF,
   environment:process.env.QORE_MOBILITY_ENV,
   liveTripsEnabled:false,
   publicKey:process.env.QORE_STAGING_ANON_KEY,
   serviceKey:process.env.QORE_STAGING_SERVICE_ROLE_KEY
  });
  console.log(JSON.stringify(report));
 }catch{
  // Never log input, HTTP response, names, credentials, email or user UUIDs.
  console.error('G254 BLOCKED: STAGING Auth QA roles or signup readiness not certified');
  process.exitCode=1;
 }
}
