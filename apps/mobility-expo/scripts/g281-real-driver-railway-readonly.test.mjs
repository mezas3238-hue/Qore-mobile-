import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyG281DriverReadOnly,g281OperatorPreflight} from './g281-real-driver-railway-readonly.mjs';

const SLOTS=[
 ['owner_admin','admin'],['passenger','passenger'],
 ['driver_auto','driver'],['driver_moto','driver'],
 ['parcel_sender','passenger'],['courier_auto','driver'],
 ['courier_moto','driver'],['merchant_owner','passenger']
];
const actors=SLOTS.map(([slot,role],i)=>({
 slot,role,email:`g281-actor-${i}@qa.invalid`,
 password:`CI_ONLY_TEST_PASSWORD_DO_NOT_USE_${i}_${'z'.repeat(25)}`
}));
const ref='mrjzxftsdxzepzbcuids';
const publicKey='sb_publishable_'+ 'A'.repeat(28);
const uuid=i=>'00000000-0000-4000-8000-'+String(i+100).padStart(12,'0');
function run({anonymousLeak=false,crossRoleLeak=false,licenseLeak=false,
   revokeLeak=false,driverUnavailable=false,signupClosed=true}={}){
 const tokens=new Map();let hits=0,logins=0,logouts=0;
 const request=async (url,opts={})=>{
  hits++;
  const u=new URL(url);
  const path=u.pathname;
  const token=opts.headers?.Authorization?.replace(/^Bearer /,'');
  if(path==='/auth/v1/token'){
   logins++;
   const body=JSON.parse(opts.body);
   const actor=actors.find(a=>a.email===body.email&&a.password===body.password);
   if(!actor)return Response.json({error:'invalid'},{status:401});
   const idx=actors.indexOf(actor);
   const accessToken=`fake${idx}.payload${idx}.signed${idx}`;
   tokens.set(accessToken,{actor,idx,revoked:false});
   return Response.json({access_token:accessToken,token_type:'bearer'});
  }
  if(path==='/auth/v1/user'){
   const s=tokens.get(token);
   return s&&!s.revoked?Response.json({
    id:uuid(s.idx),email:s.actor.email,is_anonymous:false,
    email_confirmed_at:'2026-10-31T14:00:00.000Z',
    app_metadata:{qore_stage_qa:true,qore_qa_slot:s.actor.slot}
   }):Response.json({error:'denied'},{status:401});
  }
  if(path==='/auth/v1/logout'){
   const s=tokens.get(token);
   if(!s)return Response.json({error:'denied'},{status:401});
   s.revoked=true;logouts++;
   return new Response(null,{status:204});
  }
  if(u.host==='qore-mobile-backend-staging-staging.up.railway.app'){
   assert.equal(opts.method,'GET','G281 must never write to Railway');
   assert.ok(['/v1/staging/driver/documents',
    '/v1/staging/driver/license-readiness'].includes(path));
   const s=tokens.get(token);
   if(!s||s.revoked&&!revokeLeak){
    if(anonymousLeak&&!s)return Response.json({error:'oops'});
    return Response.json({error:'Unauthorized'},{status:401});
   }
   if(s.actor.role!=='driver'&&!crossRoleLeak)
    return Response.json({error:'Forbidden'},{status:403});
   if(driverUnavailable)return Response.json({error:'Unavailable'},{status:503});
   if(path.endsWith('/documents'))
    return Response.json({mode:'STAGING_DEMO_ONLY',
      liveOperationsEnabled:false,documents:[]});
   return Response.json({mode:'STAGING_DEMO_ONLY',
     currentLicenseApproved:licenseLeak,driverEligible:false,
     liveOperationsEnabled:false,
     verificationScope:'CURRENT_LICENSE_REVIEW_ONLY'});
  }
  throw Error('Unrecognized private network origin '+u.host);
 };
 return {
  call:()=>verifyG281DriverReadOnly({ref,environment:'staging',
    liveTripsEnabled:'false',publicKey,manifest:actors,request,
    signupGate:async()=>({certified:signupClosed})}),
  state:()=>({hits,logins,logouts})
 };
}
test('G281 true external contract mock verifies Driver + Passenger with local revocation',async()=>{
 const s=run(),r=await s.call();
 assert.equal(r.ok,true);assert.equal(r.realSessionsVerified,2);
 assert.equal(r.driverDocumentsEmpty,true);
 assert.equal(r.licenseApprovalDenied,true);
 assert.equal(r.passengerAccessDenied,2);
 assert.equal(r.revocationVerified,true);
 assert.equal(r.externalJourneysCertified,0);
 assert.equal(s.state().logins,2);
 assert.equal(s.state().logouts,2);
});
test('G281 rejects a public Driver document endpoint',async()=>{
 const s=run({anonymousLeak:true}),r=await s.call();
 assert.equal(r.ok,false);
 assert.equal(r.code,'ANONYMOUS_DRIVER_ACCESS_NOT_DENIED');
 assert.equal(s.state().logins,0);
});
test('G281 rejects Passenger reading Driver documents',async()=>{
 const s=run({crossRoleLeak:true}),r=await s.call();
 assert.equal(r.ok,false);
 assert.equal(r.code,'PASSENGER_CROSSED_DRIVER_BOUNDARY');
 assert.equal(s.state().logouts,2);
});
test('G281 rejects forged license approval and preserves logout',async()=>{
 const s=run({licenseLeak:true}),r=await s.call();
 assert.equal(r.ok,false);
 assert.equal(r.code,'DRIVER_EMPTY_KYC_READ_NOT_VERIFIED');
 assert.equal(s.state().logouts,2);
});
test('G281 rejects a revoked JWT still accepted by Railway',async()=>{
 const s=run({revokeLeak:true}),r=await s.call();
 assert.equal(r.ok,false);
 assert.equal(r.code,'REVOKED_DRIVER_TOKEN_STILL_ACCEPTED');
 assert.equal(s.state().logouts,2);
});
test('G281 fails closed if Driver private RPC remains unavailable',async()=>{
 const s=run({driverUnavailable:true}),r=await s.call();
 assert.equal(r.ok,false);
 assert.equal(r.code,'DRIVER_EMPTY_KYC_READ_NOT_VERIFIED');
 assert.equal(s.state().logouts,2);
});
test('G281 stops without network when wrong project or broken manifest',async()=>{
 const r=await verifyG281DriverReadOnly({ref:'wrong',
  environment:'staging',liveTripsEnabled:'false',
  publicKey,manifest:actors,request:()=>{throw Error('no network');}});
 assert.equal(r.ok,false);assert.equal(r.code,'STAGING_ONLY_REQUIRED');
 const s=run();const manifest=actors.slice(0,7);
 const r2=await verifyG281DriverReadOnly({ref,
  environment:'staging',liveTripsEnabled:'false',publicKey,
  manifest,request:()=>{throw Error('no network');}});
 assert.equal(r2.ok,false);assert.equal(r2.code,'PRIVATE_QA_MANIFEST_INVALID');
 assert.equal(s.state().hits,0);
});
test('G281 refuses reopened public signup before credentials',async()=>{
 const s=run({signupClosed:false}),r=await s.call();
 assert.equal(r.ok,false);assert.equal(s.state().logins,0);
});

test('G281 operator preflight exposes only constant diagnostic codes, never secrets',()=>{
 const allowed={
  QORE_QA_DRIVER_READONLY_APPROVED:'CONFIRM_READ_ONLY_STAGING',
  QORE_QA_MANIFEST_FILE:'/home/agent/.qore-qa-private/actors.json',
  QORE_STAGING_PROJECT_REF:ref,
  QORE_MOBILITY_ENV:'staging',
  LIVE_TRIPS_ENABLED:'false',
  QORE_STAGING_ANON_KEY:publicKey
 };
 const argv=['node','g281-real-driver-railway-readonly.mjs','--verify'];
 assert.equal(g281OperatorPreflight(allowed,argv),null);
 for(const [field,code] of [
  ['QORE_QA_MANIFEST_FILE','G281_PRIVATE_MANIFEST_PATH_MISSING'],
  ['QORE_STAGING_PROJECT_REF','G281_STAGING_PROJECT_REF_MISSING_OR_DIFFERENT'],
  ['QORE_MOBILITY_ENV','G281_STAGING_ENVIRONMENT_REQUIRED'],
  ['LIVE_TRIPS_ENABLED','G281_LIVE_TRIPS_MUST_BE_DISABLED'],
  ['QORE_STAGING_ANON_KEY','G281_PUBLIC_KEY_MISSING_OR_INVALID'],
  ['QORE_QA_DRIVER_READONLY_APPROVED','G281_EXPLICIT_READONLY_APPROVAL_MISSING']
 ]){
  const changed={...allowed};delete changed[field];
  const result=g281OperatorPreflight(changed,argv);
  assert.equal(result,code);
  assert.ok(!result.includes(publicKey));
  assert.ok(!result.includes('actors.json'));
 }
 assert.equal(g281OperatorPreflight({...allowed,CI:'true'},argv),
  'G281_PRIVATE_OPERATOR_HOST_REQUIRED');
 assert.equal(g281OperatorPreflight({...allowed,QORE_QA_ACTORS_JSON:'SECRET_DO_NOT_ECHO'},argv),
  'G281_INLINE_CREDENTIALS_FORBIDDEN');
 assert.equal(g281OperatorPreflight(allowed,['node','script','--apply']),
  'G281_VERIFY_ONLY_REQUIRED');
});
