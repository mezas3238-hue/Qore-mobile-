/**
 * G263: real Supabase STAGING Backoffice G27 authorization evidence.
 * This gate READS the provider and existing DB rows; never writes an Admin
 * role or forges an approval. Legacy user_roles(admin) != G27 backoffice.
 */
import {pathToFileURL} from 'node:url';
import {assertStage,STAGING_REF} from './qore-staging-qa-identity-bootstrap.mjs';
import {inspectStageSignup} from './staging-auth-policy-gate.mjs';

const ORIGIN='https://'+STAGING_REF+'.supabase.co';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const deny=code=>Object.freeze({
 mode:'STAGING_ADMIN_G27_READ_ONLY',code,
 adminBackofficeCertified:false,commercialEnabled:false,
 externalJourneysCertified:0
});
async function readJson(fetcher,path,key){
 const response=await fetcher(ORIGIN+path,{
  method:'GET',redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(10000),
  headers:{apikey:key,...(JWT.test(key)?{Authorization:'Bearer '+key}:{}),
   Accept:'application/json'}
 });
 if(response?.status!==200||response.redirected===true)throw Error('Provider denied');
 return response.json();
}
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export async function verifyBackofficeG263({
 ref,environment,liveTripsEnabled,publicKey,serviceKey,
 fetcher=fetch,signupGate=inspectStageSignup
}={}){
 try{
  assertStage({ref,environment,liveTripsEnabled:String(liveTripsEnabled),
   publicKey,secret:serviceKey});
  if(typeof fetcher!=='function'||typeof signupGate!=='function')return deny('INVALID_ADAPTER');
  const policy=await signupGate({ref,key:publicKey,request:fetcher});
  if(policy?.certified!==true)return deny('SIGNUP_NOT_CERTIFIED_CLOSED');
  const response=await readJson(fetcher,'/auth/v1/admin/users?per_page=50&page=1',serviceKey);
  if(!obj(response)||!Array.isArray(response.users)||response.users.length>8)
   return deny('QA_AUTH_USERS_NOT_CERTIFIED');
  const owners=response.users.filter(u=>obj(u)&&
   u.app_metadata?.qore_stage_qa===true&&u.app_metadata?.qore_qa_slot==='owner_admin');
  if(owners.length!==1||!UUID.test(owners[0].id??'')||
   owners[0].is_anonymous!==false)
   return deny('OWNER_ADMIN_AUTH_IDENTITY_MISSING');
  const id=owners[0].id;
  const native=await readJson(fetcher,
   '/rest/v1/user_roles?select=user_id,role&user_id=eq.'+id,serviceKey);
  if(!Array.isArray(native)||native.some(r=>!obj(r)||r.user_id!==id))
   return deny('NATIVE_ROLE_ROWS_UNTRUSTED');
  // G27 deliberately denies ALL native roles: a legacy "admin" row is
  // not a backoffice approval. Don't modify the privilege boundary.
  if(native.length>0)return deny('ADMIN_NATIVE_ROLE_CONFLICT_G27');
  const approval=await readJson(fetcher,
   '/rest/v1/mobility_stage_backoffice_roles?select=user_id,role,status,approved_by&user_id=eq.'+id,
   serviceKey);
  if(!Array.isArray(approval)||approval.length!==1||!obj(approval[0]))
   return deny('INDEPENDENT_BACKOFFICE_APPROVAL_REQUIRED');
  const row=approval[0];
  if(row.user_id!==id||row.status!=='active'||
   !['admin','owner'].includes(row.role)||!UUID.test(row.approved_by??'')||
   row.approved_by===id)return deny('INDEPENDENT_BACKOFFICE_APPROVAL_REQUIRED');
  const g27=await readJson(fetcher,
   '/rest/v1/rpc/mobility_stage_g27_backoffice_role_of?_user='+id,serviceKey);
  if(g27!==row.role)return deny('G27_REAL_ROLE_NOT_CONFIRMED');
  return Object.freeze({
   mode:'STAGING_ADMIN_G27_READ_ONLY',
   code:'ADMIN_G27_INDEPENDENTLY_APPROVED',
   adminBackofficeCertified:true,commercialEnabled:false,
   externalJourneysCertified:0
  });
 }catch{return deny('PROVIDER_OR_BACKOFFICE_EVIDENCE_UNAVAILABLE');}
}
const main=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(main){
 const x=await verifyBackofficeG263({
  ref:process.env.QORE_STAGING_PROJECT_REF,
  environment:process.env.QORE_MOBILITY_ENV,
  liveTripsEnabled:process.env.LIVE_TRIPS_ENABLED,
  publicKey:process.env.QORE_STAGING_ANON_KEY,
  serviceKey:process.env.QORE_STAGING_SERVICE_ROLE_KEY
 });
 console.log('G263 STAGING Backoffice: '+x.code);
 if(!x.adminBackofficeCertified)process.exitCode=1;
}
