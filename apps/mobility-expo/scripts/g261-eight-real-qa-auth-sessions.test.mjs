import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyEightQaSessions,verifyQaManifest}
 from './g261-eight-real-qa-auth-sessions.mjs';
import {G254_QA_SLOTS} from './g254-eight-actor-qa-readonly-audit.mjs';

const REF='mrjzxftsdxzepzbcuids';
const PUB='sb_publishable_'+'p'.repeat(36);
const SECRET='sb_secret_'+'s'.repeat(36);
const NOW=Date.parse('2026-10-31T16:00:00.000Z');
const ORIGIN='https://'+REF+'.supabase.co';
const actorManifest=G254_QA_SLOTS.map(({slot,role},i)=>({
 slot,role,email:'qa-'+slot+'@example.invalid',
 password:'test-isolated-password-no-production-'+i
}));
const uuid=(i,prefix)=>String(i+1).padStart(8,'0')+
 '-'+prefix+'111-4111-8111-'+String(i+1).padStart(12,'0');
function actorAudit(){return {qaAuthAccounts:8,exclusiveQaRoles:8,
 signupDisabled:true,projectPinned:true};}
function stub({wrongProfile=false,expired=false,badSession=false,
 deniedLoginIndex=-1,logoutFailure=false}={}){
 const tokens=new Map(),active=new Set(),calls=[];
 const mint=(i)=>{
  const obj={iss:ORIGIN+'/auth/v1',role:'authenticated',aud:'authenticated',
   sub:uuid(i,'1'),session_id:uuid(i,'2'),
   iat:Math.floor(NOW/1000)-5,exp:Math.floor(NOW/1000)+(expired?-1:3600)};
  return [Buffer.from('{"alg":"HS256"}').toString('base64url'),
   Buffer.from(JSON.stringify(obj)).toString('base64url'),'signature'].join('.');
 };
 const fetcher=async(url,options)=>{
  const u=new URL(url),path=u.pathname,method=options.method;
  assert.equal(u.origin,ORIGIN);
  calls.push({path,method,headers:options.headers});
  if(path==='/auth/v1/token'&&method==='POST'){
   const {email,password}=JSON.parse(options.body);
   const i=actorManifest.findIndex(a=>a.email===email&&a.password===password);
   if(i<0||i===deniedLoginIndex)return {status:401};
   const token=mint(i);tokens.set(token,i);active.add(uuid(i,'2'));
   return {status:200,json:async()=>({token_type:'bearer',access_token:token})};
  }
  if(path==='/auth/v1/user'&&method==='GET'){
   const token=options.headers.Authorization.slice(7),i=tokens.get(token);
   if(i===undefined)return {status:401};
   return {status:200,json:async()=>({
    id:uuid(i,'1'),is_anonymous:false,
    email_confirmed_at:'2026-10-31T00:00:00Z',
    app_metadata:{qore_stage_qa:true,qore_qa_slot:wrongProfile?'other':actorManifest[i].slot}
   })};
  }
  if(path==='/rest/v1/rpc/mobility_stage_g42_session_active'&&method==='POST'){
   assert.equal(options.headers.apikey,SECRET);
   assert.equal(options.headers.Authorization,undefined);
   const {_user,_session,_iat_ms}=JSON.parse(options.body);
   const valid=actorManifest.some((_,i)=>
    _user===uuid(i,'1')&&_session===uuid(i,'2')&&
    active.has(_session)&&_iat_ms===(Math.floor(NOW/1000)-5)*1000);
   return {status:200,json:async()=>badSession?false:valid};
  }
  if(path==='/auth/v1/logout'&&method==='POST'){
   assert.equal(u.searchParams.get('scope'),'local');
   const i=tokens.get(options.headers.Authorization.slice(7));
   if(i===undefined)return {status:401};
   if(logoutFailure)return {status:503};
   active.delete(uuid(i,'2'));
   return {status:204};
  }
  throw Error('unexpected path '+path);
 };
 return {fetcher,calls,active};
}
const run=(stubbed,opts={})=>verifyEightQaSessions({
 ref:REF,environment:'staging',liveTripsEnabled:false,
 publicKey:PUB,serviceKey:SECRET,manifest:actorManifest,
 fetcher:stubbed.fetcher,actorAudit,now:()=>NOW,...opts
});

test('G261 verifies eight provider sessions, cross-user denial, local revocation and zero journey claims',async()=>{
 const m=stub(),v=await run(m);
 assert.deepEqual(v,{
  mode:'PROVIDER_AUTH_SESSION_ONLY',
  eightIndependentPasswordSessionsVerified:8,
  crossIdentitySessionDenied:1,
  verifiedLocallyRevokedSessions:8,
  externalJourneysCertified:0,commercialLaunchAllowed:false
 });
 assert.equal(m.active.size,0);
 assert.equal(m.calls.filter(c=>c.path==='/auth/v1/token').length,8);
 assert.equal(m.calls.filter(c=>c.path==='/auth/v1/logout').length,8);
 assert.equal(m.calls.filter(c=>c.path==='/rest/v1/rpc/mobility_stage_g42_session_active').length,17);
});
test('G261 blocks wrong environment, LIVE and malformed manifests before network access',async()=>{
 const m=stub();
 for(const patch of [{ref:'qdqrlgzlotnfdxzpacxs'},
  {environment:'production'},{liveTripsEnabled:true},
  {manifest:actorManifest.slice(1)}]){
  await assert.rejects(run(m,patch),/G261 STAGING/);
 }
 assert.equal(m.calls.length,0);
 assert.equal(verifyQaManifest(actorManifest).length,8);
 assert.throws(()=>verifyQaManifest(actorManifest.map((a,i)=>
  i===7?{...a,password:actorManifest[0].password}:a)),/G261 STAGING/);
});
test('G261 provider mismatches and expiration block and revoke the partial session',async()=>{
 for(const m of [stub({wrongProfile:true}),stub({expired:true}),stub({badSession:true})]){
  await assert.rejects(run(m),/G261 STAGING/);
  assert.equal(m.active.size,0);
  assert.equal(m.calls.filter(c=>c.path==='/auth/v1/logout').length,1);
 }
});
test('G261 failed password login cleans up already authenticated QA sessions',async()=>{
 const m=stub({deniedLoginIndex:3});
 await assert.rejects(run(m),/G261 STAGING/);
 assert.equal(m.active.size,0);
 assert.equal(m.calls.filter(c=>c.path==='/auth/v1/logout').length,3);
});
test('G261 never certifies cleanup when the sign-out endpoint cannot revoke sessions',async()=>{
 const m=stub({logoutFailure:true});
 await assert.rejects(run(m),/G261 STAGING/);
 assert.equal(m.active.size,8);
});
test('G261 independent actor audit must certify closed signup and eight exact roles',async()=>{
 const m=stub();
 await assert.rejects(run(m,{actorAudit:async()=>({
  qaAuthAccounts:7,exclusiveQaRoles:7,signupDisabled:true,projectPinned:true
 })}),/G261 STAGING/);
 assert.equal(m.calls.length,0);
});
