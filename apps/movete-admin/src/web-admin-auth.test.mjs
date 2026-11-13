import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebAdminAuth} from './web-admin-auth.mjs';
import {verifyWebAdminConfig} from './web-admin-config.mjs';
const admin='88880000-0000-4888-8888-000000000001';
const factorId='88880000-0000-4888-8888-000000000002';
const now=1900000000000;
function fixture({role='admin',aal='aal2',factors=1,verified=true,confirmed=true,roleError=null}={}){
 const events=[];
 let level=aal,registered=factors>0,unverified=false;
 const supabase={
  auth:{
   getSession:async()=>({data:{session:{
    access_token:'admin-private-access-token-abcdefghijklmnopqrstuvwxyz',
    expires_at:(now+300000)/1000,user:{id:admin}
   }},error:null}),
   getUser:async()=>{events.push('getUser');return {data:{user:{
    id:admin,is_anonymous:false,email_confirmed_at:confirmed?'2026-10-24T10:00:00Z':null
   }},error:verified?null:{code:401}};},
   signInWithPassword:async()=>{events.push('login');return {error:null};},
   signOut:async()=>{events.push('logout');return {error:null};},
   mfa:{
    getAuthenticatorAssuranceLevel:async()=>{events.push('aal');return {data:{
     currentLevel:level,nextLevel:'aal2'},error:null};},
    listFactors:async()=>{events.push('factors');return {data:{totp:
     Array.from({length:factors},(_,i)=>({id:i===0?factorId:admin,status:i===0&&unverified?'unverified':'verified'}))
    },error:null};},
    enroll:async ({factorType,friendlyName})=>{
     events.push(['enroll',factorType,friendlyName]);
     factors=1;unverified=true;
     return {data:{id:factorId,totp:{secret:'JBSWY3DPEHPK3PXP'}},error:null};
    },
    challengeAndVerify:async ({factorId:id,code})=>{
     events.push(['mfa',id,code]);
     if(code==='999999')return {error:{code:'mfa_verification_failed'}};
     level='aal2';registered=true;unverified=false;return {error:null};
    }
   }
  },
  rpc:async (name,args)=>{
   events.push(['rpc',name,args]);
   return {data:role,error:roleError};
  },
  from:()=>{throw Error('G27 forbids native user_roles role lookup');}
 };
 return {auth:createWebAdminAuth({supabase,now:()=>now}),events};
}
test('Admin browser refuses HTTP, arbitrary hosts, secret/service role, URL credentials',()=>{
 for(const data of [
  {url:'https://example.org',publishableKey:'sb_publishable_abcdefghijklmnopqrst'},
  {url:'http://staging1234567890abcd.supabase.co',publishableKey:'sb_publishable_abcdefghijklmnopqrst'},
  {url:'https://staging1234567890abcd.supabase.co',publishableKey:'sb_secret_SECRETNEVERINWEB'},
  {url:'https://a@staging1234567890abcd.supabase.co',publishableKey:'sb_publishable_abcdefghijklmnopqrst'}
 ])assert.equal(verifyWebAdminConfig(data).ok,false);
 assert.equal(verifyWebAdminConfig({url:'https://staging1234567890abcd.supabase.co',
  publishableKey:'sb_publishable_abcdefghijklmnopqrst'}).ok,true);
});
test('G264 Admin session requires IdP MFA and exclusive self-only backoffice role',async()=>{
 const f=fixture(),identity=await f.auth.readSession();
 assert.equal(identity.role,'admin');assert.equal(identity.subject,admin);
 assert.equal(identity.mfaVerified,true);
 assert.deepEqual(f.events.at(-1),['rpc','mobility_stage_g264_my_backoffice_role',undefined]);
 assert.equal(JSON.stringify(identity).includes('password'),false);
});
test('Owner can read own finance but cannot inherit Admin role',async()=>{
 const f=fixture({role:'owner'}),session=await f.auth.readSession();
 assert.equal(session.role,'owner');
});
test('Password or browser role without AAL2 never unlocks Admin; invalid G264/IdP means no data',async()=>{
 for(const settings of [
  {aal:'aal1'},{factors:0},{factors:2},{role:'driver'},
  {role:'passenger'},{role:['admin','owner']},{role:null},{confirmed:false},
  {verified:false},{roleError:{code:'42501'}}
 ]){
  const f=fixture(settings);
  assert.equal(await f.auth.readSession(),null,JSON.stringify(settings));
 }
});
test('Password sign-in only queues verified MFA, six-digit challenge promotes provider AAL2',async()=>{
 const f=fixture({aal:'aal1'});
 assert.equal((await f.auth.signIn('owner@example.com','SecurePassword123')).code,'MFA_REQUIRED');
 const second=await f.auth.verifyTotp('123456');
 assert.equal(second.ok,true);assert.equal(second.role,'admin');
 assert(f.events.some(x=>Array.isArray(x)&&x[0]==='mfa'&&x[1]===factorId));
 assert.equal((await f.auth.readSession()).mfaVerified,true);
});
test('AAL1 with no MFA offers setup only, never a verified admin session',async()=>{
 const f=fixture({aal:'aal1',factors:0});
 assert.equal((await f.auth.signIn('admin@example.com','SecurePassword123')).code,
  'MFA_ENROLLMENT_REQUIRED');
 assert.equal(await f.auth.readSession(),null);
 assert.equal(f.events.some(x=>Array.isArray(x)&&x[0]==='rpc'),false,
  'AAL1 never touches backoffice role RPC');
 const setup=await f.auth.beginTotpEnrollment();
 assert.equal(setup.ok,true);
 assert.equal(setup.secret,'JBSWY3DPEHPK3PXP');
 assert.equal((await f.auth.beginTotpEnrollment()).code,'MFA_SETUP_NOT_AUTHORIZED');
 assert.equal((await f.auth.verifyEnrolledTotp('999999')).code,'MFA_DENIED');
 assert.equal(await f.auth.readSession(),null);
 const verified=await f.auth.verifyEnrolledTotp('123456');
 assert.equal(verified.ok,true);
 assert.equal(verified.role,'admin');
 assert.equal((await f.auth.beginTotpEnrollment()).code,'MFA_SETUP_NOT_AUTHORIZED');
 assert.equal((await f.auth.readSession()).mfaVerified,true);
});
test('TOTP enrollment cannot grant an unapproved Owner or Admin role',async()=>{
 const f=fixture({aal:'aal1',factors:0,role:null});
 assert.equal((await f.auth.signIn('owner@example.com','SecurePassword123')).code,
  'MFA_ENROLLMENT_REQUIRED');
 assert.equal((await f.auth.beginTotpEnrollment()).ok,true);
 const result=await f.auth.verifyEnrolledTotp('123456');
 assert.equal(result.code,'BACKOFFICE_ROLE_NOT_APPROVED');
 assert.equal(f.events.at(-1),'logout');
 assert.equal(await f.auth.readSession(),null);
});
test('Without sign-in, MFA enrollment and invalid codes are refused',async()=>{
 const f=fixture({aal:'aal1',factors:0});
 assert.equal((await f.auth.beginTotpEnrollment()).code,'MFA_SETUP_NOT_AUTHORIZED');
 assert.equal((await f.auth.verifyEnrolledTotp('123456')).code,'MFA_SETUP_NOT_AUTHORIZED');
 const v=fixture();
 assert.equal((await v.auth.verifyTotp('000000000')).code,'INVALID_TOTP');
 assert.equal(v.events.length,0);
});
test('Multiple registered factors cannot trigger MFA self-enrollment bypass',async()=>{
 const f=fixture({aal:'aal1',factors:2});
 const signed=await f.auth.signIn('admin@example.com','SecurePassword123');
 assert.equal(signed.code,'MFA_FACTOR_NOT_ELIGIBLE');
 assert.equal(f.events.at(-1),'logout');
 assert.equal((await f.auth.beginTotpEnrollment()).code,'MFA_SETUP_NOT_AUTHORIZED');
});
test('G264 role lookup never queries the RLS native user_roles table',async()=>{
 const f=fixture();
 const s=await f.auth.readSession();
 assert.equal(s.role,'admin');
 assert.equal(f.events.some(x=>Array.isArray(x)&&x[0]==='rpc'&&
  x[1]==='mobility_stage_g264_my_backoffice_role'),true);
 assert.equal(f.events.some(x=>Array.isArray(x)&&x[0]==='from'),false);
});
test('Remote logout must run, never persist browser token',async()=>{
 const f=fixture();
 await f.auth.signOut();
 assert.deepEqual(f.events,['logout']);
});
