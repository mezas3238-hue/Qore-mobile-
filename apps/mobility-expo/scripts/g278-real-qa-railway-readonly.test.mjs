import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyG278RealQaRailway} from './g278-real-qa-railway-readonly.mjs';
import {QA_SLOTS,STAGING_REF} from './qore-staging-qa-identity-bootstrap.mjs';
const manifest=QA_SLOTS.map(([slot,role],i)=>({slot,role,
 email:'qore-'+slot+'@qore.invalid',
 password:'PRIVATE_OFFLINE_UNIT_TEST_'+i+'_ONLY_xxxxxxxx'
}));
const conf={ref:STAGING_REF,environment:'staging',liveTripsEnabled:'false',
 publicKey:'sb_publishable_'+'p'.repeat(36),manifest};
const origin='https://qore-mobile-backend-staging-staging.up.railway.app';
const provider='https://'+STAGING_REF+'.supabase.co';
const UUIDs=QA_SLOTS.map((_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
const json=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json'}});
function mock({exposeDriver=false,acceptRevoked=false,logoutFails=false}={}){
 const calls=[],sessions=new Map();
 let count=0;
 const request=async(url,opts)=>{
  const u=new URL(url);calls.push({url:u.origin+u.pathname,method:opts.method,
   hasAuthorization:!!opts.headers?.Authorization});
  if(u.origin===provider&&u.pathname==='/auth/v1/token'){
   assert.equal(opts.method,'POST');
   const email=JSON.parse(opts.body).email;
   const actor=manifest.find(x=>x.email===email);
   assert.ok(actor);
   const i=QA_SLOTS.findIndex(([slot])=>slot===actor.slot);
   const token='header'+i+'.payload'+i+'.signature'+i+'abcdefghij';
   sessions.set(token,{actor,id:UUIDs[i],active:true});
   count++;
   return json({token_type:'bearer',access_token:token});
  }
  if(u.origin===provider&&u.pathname==='/auth/v1/user'){
   const token=opts.headers.Authorization?.replace('Bearer ','');
   const s=sessions.get(token);
   assert.ok(s&&s.active);
   return json({id:s.id,is_anonymous:false,email:s.actor.email,
    app_metadata:{qore_stage_qa:true,qore_qa_slot:s.actor.slot},
    email_confirmed_at:'2026-10-31T00:00:00Z'});
  }
  if(u.origin===provider&&u.pathname==='/auth/v1/logout'){
   assert.equal(u.searchParams.get('scope'),'local');
   const token=opts.headers.Authorization?.replace('Bearer ','');
   const s=sessions.get(token);
   assert.ok(s);
   if(logoutFails)return new Response(null,{status:503});
   s.active=false;
   return new Response(null,{status:204});
  }
  if(u.origin===origin&&u.pathname==='/v1/staging/rider/history'){
   assert.equal(opts.method,'GET');
   const token=opts.headers.Authorization?.replace('Bearer ','');
   if(!token)return json({error:'Verified session required'},401);
   const s=sessions.get(token);
   if(!s)return json({error:'Unknown'},401);
   if(!s.active&&!acceptRevoked)return json({error:'Revoked'},401);
   if(s.actor.slot==='passenger')
    return json({ownerId:s.id,items:[],nextCursor:null,generatedAt:1,expiresAt:2});
   return exposeDriver?json({ownerId:s.id,items:[],nextCursor:null}):
    json({error:'Passenger role required'},403);
  }
  throw Error('unexpected test route '+u.pathname);
 };
 return {request,calls,sessions,get count(){return count}};
}
test('G278 proves provider-backed passenger read-only history and denies Driver/Admin',async()=>{
 const m=mock();
 const r=await verifyG278RealQaRailway({...conf,request:m.request,
  signupGate:async()=>({certified:true})});
 assert.equal(r.ok,true);
 assert.equal(r.providerSessionsVerified,3);
 assert.equal(r.nonPassengerAccessDenied,2);
 assert.equal(r.revocationVerified,true);
 assert.equal(r.externalJourneysCertified,0);
 assert.equal(r.commercialEnabled,false);
 assert.equal(m.count,3);
 assert.equal([...m.sessions.values()].every(x=>x.active===false),true);
 assert.equal(m.calls.some(x=>x.url.includes('/v1/staging/rider/trips/request')),false);
 assert.equal(m.calls.filter(x=>x.url.includes('/v1/staging/rider/history')).length,5);
});
test('G278 blocks cross-role data exposure without claiming E2E',async()=>{
 const m=mock({exposeDriver:true});
 const r=await verifyG278RealQaRailway({...conf,request:m.request,
  signupGate:async()=>({certified:true})});
 assert.equal(r.ok,false);
 assert.equal(r.code,'CROSS_ROLE_HISTORY_NOT_DENIED');
 assert.equal([...m.sessions.values()].every(x=>!x.active),true);
});
test('G278 blocks stale passenger JWT after local logout',async()=>{
 const m=mock({acceptRevoked:true});
 const r=await verifyG278RealQaRailway({...conf,request:m.request,
  signupGate:async()=>({certified:true})});
 assert.equal(r.ok,false);
 assert.equal(r.code,'REVOKED_PASSENGER_SESSION_STILL_READABLE');
});
test('G278 refuses incomplete local logout evidence',async()=>{
 const m=mock({logoutFails:true});
 const r=await verifyG278RealQaRailway({...conf,request:m.request,
  signupGate:async()=>({certified:true})});
 assert.equal(r.ok,false);
 assert.equal(r.code,'AUTH_SESSION_LOGOUT_UNVERIFIED');
});
test('G278 checks manifest and staging conditions before network',async()=>{
 for(const overrides of [{ref:'qdqrlgzlotnfdxzpacxs'},
  {environment:'production'},{liveTripsEnabled:'true'},
  {publicKey:'invalid'}, {manifest:manifest.slice(0,7)}]){
  const m=mock();
  const r=await verifyG278RealQaRailway({...conf,...overrides,
   request:m.request,signupGate:async()=>({certified:true})});
  assert.equal(r.ok,false);
  assert.equal(m.calls.length,0);
 }
});
test('G278 never logs in when public signup safety gate fails',async()=>{
 const m=mock();
 const r=await verifyG278RealQaRailway({...conf,request:m.request,
  signupGate:async()=>({certified:false})});
 assert.equal(r.ok,false);
 assert.equal(m.calls.length,0);
});
