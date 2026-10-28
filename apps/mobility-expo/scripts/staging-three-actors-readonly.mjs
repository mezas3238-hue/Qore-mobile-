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
const GMAIL_QA=/^[A-Za-z0-9._+-]+@gmail\.com$/i;
// Users explicitly authorized confirmed Gmail QA accounts on this isolated
// backend; never accept unpinned real-email QA on other projects.
const PINNED_QA_REF='hylgkfgkcyrddokloljm';
const fixtureRoles=['passenger','driver','driver'];
const noLive={mode:'STAGING_ONLY',commercialRidesEnabled:false};

function validateFixtures(input,{ref,allowApprovedGmailFixtures=false}={}){
 if(!Array.isArray(input)||input.length!==3)throw Error('Three distinct fixture accounts required');
 const seen=new Set(),seenIds=new Set();
 input.forEach((f,i)=>{
  const synthetic=typeof f?.email==='string'&&TEST_EMAIL.test(f.email);
  const authorizedGmail=typeof f?.email==='string'&&
   allowApprovedGmailFixtures===true&&ref===PINNED_QA_REF&&
   GMAIL_QA.test(f.email)&&UUID.test(f.expectedUserId??'');
  if(!f||(!synthetic&&!authorizedGmail)||
     typeof f.password!=='string'||f.password.length<12||
     f.role!==fixtureRoles[i]||seen.has(f.email.toLowerCase())||
     (f.expectedUserId!==undefined&&!UUID.test(f.expectedUserId))||
     (f.expectedUserId!==undefined&&seenIds.has(f.expectedUserId)))
   throw Error('Only explicitly pinned, distinct confirmed staging QA accounts allowed');
  seen.add(f.email.toLowerCase());
  if(f.expectedUserId)seenIds.add(f.expectedUserId);
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
 signupGate=inspectStageSignup,allowApprovedGmailFixtures=false
}){
 if(environment!=='staging'||liveTripsEnabled!==false)
  throw Error('Isolated staging and LIVE_TRIPS_ENABLED=false required');
 const safe=safeStageRef(ref);
 assertPublishableKey(anonKey,safe);
 validateFixtures(fixtures,{ref:safe,allowApprovedGmailFixtures});
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
     typeof own?.email!=='string'||
     own.email.toLowerCase()!==fixture.email.toLowerCase()||
     (fixture.expectedUserId&&own.id!==fixture.expectedUserId)||
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
  // Never accept truncated results as proof of role uniqueness or RLS.
  // PostgREST pagination is capped explicitly; >3 rows fails closed.
  if(!Array.isArray(rows)||rows.length>3)
   throw Error('Unexpected private RLS response shape');
  return rows;
 };
 for(const me of identities){
  const profile=await query(me,'profiles','id',me.id);
  if(profile.length!==1||profile[0].id!==me.id)
   throw Error('Self profile not visible or profile mismatch');
  // Query ALL roles for the actor, not a filtered expected role: detect admin
  // or secondary privileges even when the primary role looks correct.
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
  {email:get('QORE_STAGING_PASSENGER_EMAIL'),password:get('QORE_STAGING_PASSENGER_PASSWORD'),role:'passenger',expectedUserId:get('QORE_STAGING_PASSENGER_USER_ID')},
  {email:get('QORE_STAGING_DRIVER_A_EMAIL'),password:get('QORE_STAGING_DRIVER_A_PASSWORD'),role:'driver',expectedUserId:get('QORE_STAGING_DRIVER_A_USER_ID')},
  {email:get('QORE_STAGING_DRIVER_B_EMAIL'),password:get('QORE_STAGING_DRIVER_B_PASSWORD'),role:'driver',expectedUserId:get('QORE_STAGING_DRIVER_B_USER_ID')}
 ];
 await verifyThreeActorIsolation({
  ref:get('QORE_STAGING_PROJECT_REF'),anonKey:get('QORE_STAGING_ANON_KEY'),
  environment:get('QORE_MOBILITY_ENV'),liveTripsEnabled:get('LIVE_TRIPS_ENABLED')==='false'?false:null,
  fixtures,allowApprovedGmailFixtures:get('QORE_STAGING_APPROVED_GMAIL_QA')==='true'
 });
 console.log('PASS: 3 confirmed STAGING JWTs, one passenger and two drivers; RLS own/foreign and role isolation. NO LIVE.');
}
