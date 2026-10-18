/**
 * QORE STAGING ONLY — JWT E2E read-isolation among 1 passenger + 2 drivers.
 * Requires pre-existing, confirmed ADMIN-created synthetic Auth users.
 * Login POST produces Auth sessions but this script does not write application
 * tables, migrate, upload files, assign roles, or dispatch any trips.
 * NEVER use on production; no email, UUID, JWT or password is logged.
 */
import {fileURLToPath} from 'node:url';
import {inspectStageSignup,safeStageRef,assertPublishableKey} from './staging-auth-policy-gate.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEST_EMAIL=/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.invalid$/i;
const fixtureRoles=['passenger','driver','driver'];
const noLive={mode:'STAGING_ONLY',commercialRidesEnabled:false};

function validateFixtures(input){
 if(!Array.isArray(input)||input.length!==3)throw Error('Three distinct fixture accounts required');
 const seen=new Set();
 input.forEach((f,i)=>{
  if(!f||!TEST_EMAIL.test(f.email??'')||
     typeof f.password!=='string'||f.password.length<12||
     f.role!==fixtureRoles[i]||seen.has(f.email.toLowerCase()))
   throw Error('Only distinct .invalid confirmed passenger + driver + driver fixtures allowed');
  seen.add(f.email.toLowerCase());
 });
}
async function readJson(fetcher,url,options){
 const r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r?.ok)throw Error('Verified staging Auth/REST request unavailable');
 return await r.json();
}
/** All tests are real when called with real fetch, but offline unit tests inject
 * mock fetch+signupGate; NEVER derive actor identity by decoding a raw JWT. */
export async function verifyThreeActorIsolation({
 ref,anonKey,fixtures,environment,liveTripsEnabled,fetcher=fetch,
 signupGate=inspectStageSignup
}){
 if(environment!=='staging'||liveTripsEnabled!==false)
  throw Error('Isolated staging and LIVE_TRIPS_ENABLED=false required');
 const safe=safeStageRef(ref);
 assertPublishableKey(anonKey,safe);
 validateFixtures(fixtures);
 if(typeof fetcher!=='function'||typeof signupGate!=='function')
  throw Error('Missing trusted staging network adapters');
 const gate=await signupGate({ref:safe,key:anonKey,request:fetcher});
 if(gate.certified!==true)throw Error('Native disable_signup=true is mandatory');
 const endpoint='https://'+safe+'.supabase.co';
 const identities=[];
 for(const fixture of fixtures){
  const tokenReply=await readJson(fetcher,endpoint+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:{apikey:anonKey,'content-type':'application/json'},
   body:JSON.stringify({email:fixture.email,password:fixture.password})
  });
  const access=tokenReply?.access_token;
  if(typeof access!=='string'||access.length<20)
   throw Error('Verified synthetic session unavailable');
  const headers={apikey:anonKey,Authorization:'Bearer '+access};
  const own=await readJson(fetcher,endpoint+'/auth/v1/user',{method:'GET',headers});
  if(!UUID.test(own?.id??'')||own?.is_anonymous===true||
     !own?.email_confirmed_at||
     own.email.toLowerCase()!==fixture.email.toLowerCase()||
     identities.some(x=>x.id===own.id))
   throw Error('Distinct confirmed synthetic Auth identity required');
  identities.push({id:own.id,role:fixture.role,headers});
 }
 const query=async(actor,table,column,target)=>{
  const url=new URL(endpoint+'/rest/v1/'+table);
  url.searchParams.set('select',table==='user_roles'?'user_id,role':'id');
  url.searchParams.set(column,'eq.'+target);
  const rows=await readJson(fetcher,url.toString(),{
   method:'GET',headers:actor.headers
  });
  if(!Array.isArray(rows)||rows.length>3)
   throw Error('Unexpected private RLS response shape');
  return rows;
 };
 for(const me of identities){
  const profile=await query(me,'profiles','id',me.id);
  if(profile.length!==1||profile[0].id!==me.id)
   throw Error('Self profile not visible or profile mismatch');
  const roles=await query(me,'user_roles','user_id',me.id);
  if(roles.length!==1||roles[0].user_id!==me.id||roles[0].role!==me.role)
   throw Error('Fixture role incorrect: admin, dual-role or missing role');
  for(const other of identities.filter(x=>x.id!==me.id)){
   if((await query(me,'profiles','id',other.id)).length!==0||
      (await query(me,'user_roles','user_id',other.id)).length!==0)
    throw Error('CRITICAL: foreign actor data visible to another Auth account');
  }
 }
 return {...noLive,verified:true,accountsVerified:3,rolesVerified:['passenger','driver','driver'],foreignAccessDenied:true};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const get=key=>process.env[key];
 const fixtures=[
  {email:get('QORE_STAGING_PASSENGER_EMAIL'),password:get('QORE_STAGING_PASSENGER_PASSWORD'),role:'passenger'},
  {email:get('QORE_STAGING_DRIVER_A_EMAIL'),password:get('QORE_STAGING_DRIVER_A_PASSWORD'),role:'driver'},
  {email:get('QORE_STAGING_DRIVER_B_EMAIL'),password:get('QORE_STAGING_DRIVER_B_PASSWORD'),role:'driver'}
 ];
 await verifyThreeActorIsolation({
  ref:get('QORE_STAGING_PROJECT_REF'),anonKey:get('QORE_STAGING_ANON_KEY'),
  environment:get('QORE_MOBILITY_ENV'),liveTripsEnabled:get('LIVE_TRIPS_ENABLED')==='false'?false:null,
  fixtures
 });
 console.log('PASS: 3 confirmed STAGING JWTs, one passenger and two drivers; RLS own/foreign and role isolation. NO LIVE.');
}
