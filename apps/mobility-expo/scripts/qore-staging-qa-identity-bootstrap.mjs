/**
 * QORE Mobile isolated Supabase STAGING QA user bootstrap (one-shot).
 * No network activity without --apply. No service-role credentials in clients,
 * CI, messages or logs. Never use on production.
 */
import {pathToFileURL} from 'node:url';
import {inspectStageSignup,assertPublishableKey} from './staging-auth-policy-gate.mjs';

export const STAGING_REF='mrjzxftsdxzepzbcuids';
export const QA_SLOTS=Object.freeze([
 ['owner_admin','admin'],['passenger','passenger'],
 ['driver_auto','driver'],['driver_moto','driver'],
 ['parcel_sender','passenger'],['courier_auto','driver'],
 ['courier_moto','driver'],['merchant_owner','passenger']
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL=/^[a-z0-9._+-]+@[a-z0-9.-]+\.invalid$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function assertSecret(secret){
 if(typeof secret!=='string'||secret.length<30||/\s/.test(secret))throw Error('Private backend credential missing');
 if(/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(secret))return;
 if(!JWT.test(secret))throw Error('Requires STAGING service-role or secret key');
 let claims;
 try{claims=JSON.parse(Buffer.from(secret.split('.')[1],'base64url').toString('utf8'));}
 catch{throw Error('Private credential claims invalid');}
 if(claims?.role!=='service_role'||(claims.ref&&claims.ref!==STAGING_REF))
  throw Error('Wrong privilege or project for backend secret');
}

export function verifyManifest(manifest){
 if(!Array.isArray(manifest)||manifest.length!==QA_SLOTS.length)throw Error('Exactly eight independent QA identities required');
 const uniqueEmail=new Set(),uniquePassword=new Set();
 return manifest.map((x,i)=>{
  const [slot,role]=QA_SLOTS[i];
  if(x?.slot!==slot||x.role!==role||typeof x.email!=='string'||!EMAIL.test(x.email)||
   typeof x.password!=='string'||x.password.length<20||x.password.length>128||
   uniqueEmail.has(x.email.toLowerCase())||uniquePassword.has(x.password))
   throw Error('Invalid, duplicate, misordered or insufficiently secret QA identity');
  uniqueEmail.add(x.email.toLowerCase());uniquePassword.add(x.password);
  return {slot,role,email:x.email,password:x.password};
 });
}

export function assertStage({ref,environment,liveTripsEnabled,publicKey,secret}){
 if(ref!==STAGING_REF||environment!=='staging'||liveTripsEnabled!=='false')
  throw Error('Noncommercial pinned Supabase STAGING required');
 assertPublishableKey(publicKey,ref);
 assertSecret(secret);
 if(publicKey===secret)throw Error('Public and private credentials may not match');
}

async function request(fetcher,url,{method='GET',key,body,headers={}}={}){
 const res=await fetcher(url,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{
  apikey:key,Authorization:'Bearer '+key,Accept:'application/json',
  ...(body===undefined?{}:{'content-type':'application/json'}),
  ...headers
 },...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!res?.ok)throw Error('STAGING QA API failed at '+new URL(url).pathname+' HTTP '+(res?.status??'unknown'));
 if(res.status===204)return null;
 return res.json();
}
async function ownRole({fetcher,root,secret,id}){
 const u=new URL(root+'/rest/v1/user_roles');
 u.searchParams.set('select','user_id,role');u.searchParams.set('user_id','eq.'+id);
 const rows=await request(fetcher,u.toString(),{key:secret});
 if(!Array.isArray(rows)||rows.length!==1||rows[0].user_id!==id)
  throw Error('Auth trigger did not provision unique role');
 return rows[0].role;
}
export async function bootstrapQa({ref,environment,liveTripsEnabled,publicKey,secret,manifest,fetcher=fetch,signupGate=inspectStageSignup}){
 assertStage({ref,environment,liveTripsEnabled,publicKey,secret});
 const actors=verifyManifest(manifest);
 const gate=await signupGate({ref,key:publicKey,request:fetcher});
 if(gate?.certified!==true)throw Error('Supabase Auth disable_signup=true not independently verified');
 const root='https://'+ref+'.supabase.co';
 // Stop before ANY new identity when STAGING already contains users.
 // After a partial write failure, operator must review and recover manually.
 const existing=await request(fetcher,root+'/auth/v1/admin/users?per_page=50&page=1',{key:secret});
 if(!Array.isArray(existing?.users)||existing.users.length!==0)
  throw Error('STAGING Auth has users or untrusted response; manual audit required');
 let created=0;
 for(const actor of actors){
  const obj=await request(fetcher,root+'/auth/v1/admin/users',{
   method:'POST',key:secret,body:{
    email:actor.email,password:actor.password,email_confirm:true,
    app_metadata:{qore_stage_qa:true,qore_qa_slot:actor.slot}
   }
  });
  const user=obj?.user??obj;
  if(!UUID.test(user?.id??'')||user?.email?.toLowerCase()!==actor.email.toLowerCase())
   throw Error('Auth admin create did not confirm distinct QA identity');
  if(await ownRole({fetcher,root,secret,id:user.id})!=='passenger')
   throw Error('Unexpected trigger role after QA user creation');
  if(actor.role!=='passenger'){
   const url=new URL(root+'/rest/v1/user_roles');
   url.searchParams.set('user_id','eq.'+user.id);
   url.searchParams.set('role','eq.passenger');
   const updated=await request(fetcher,url.toString(),{
    method:'PATCH',key:secret,body:{role:actor.role},
    headers:{Prefer:'return=representation'}
   });
   if(!Array.isArray(updated)||updated.length!==1||
      updated[0].user_id!==user.id||updated[0].role!==actor.role)
    throw Error('Role transition not atomically confirmed');
  }
  if(await ownRole({fetcher,root,secret,id:user.id})!==actor.role)
   throw Error('Final actor role mismatch');
  created++;
 }
 return {mode:'STAGING_ONLY',count:created,roles:QA_SLOTS.map(x=>x[1]),commercialEnabled:false};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{
  if(process.argv.includes('--plan')){
   console.log('STAGING plan: '+QA_SLOTS.map(x=>x[0]+':'+x[1]).join(', '));
   console.log('No requests performed; no credentials read');
  }else if(process.argv.includes('--apply')&&process.argv.length===3){
   if(process.env.QORE_QA_EXPLICIT_APPLY!=='CONFIRM_STAGING_ONLY')
    throw Error('Explicit staging operator gate required');
   let manifest;
   try{manifest=JSON.parse(process.env.QORE_QA_ACTORS_JSON??'');}
   catch{throw Error('Secure QA manifest JSON missing');}
   const result=await bootstrapQa({
    ref:process.env.QORE_STAGING_PROJECT_REF,
    environment:process.env.QORE_MOBILITY_ENV,
    liveTripsEnabled:process.env.LIVE_TRIPS_ENABLED,
    publicKey:process.env.QORE_STAGING_ANON_KEY,
    secret:process.env.QORE_STAGING_SERVICE_ROLE_KEY,
    manifest
   });
   console.log('PASS: '+result.count+' QA Auth identities staged, no LIVE enabled; email/UUID/password omitted');
  }else throw Error('Use --plan or --apply exclusively');
 }catch{
  console.error('BLOCKED: QORE STAGING QA identity gate failed; review without printing credentials');
  process.exitCode=1;
 }
}
