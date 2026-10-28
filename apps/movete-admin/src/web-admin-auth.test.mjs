import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebAdminAuth} from './web-admin-auth.mjs';
import {verifyWebAdminConfig} from './web-admin-config.mjs';
const admin='88880000-0000-4888-8888-000000000001';
const factorId='88880000-0000-4888-8888-000000000002';
const now=1900000000000;
function fixture({role='admin',aal='aal2',factors=1,verified=true,confirmed=true,roleError=null}={}){
 const events=[];
 let level=aal;
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
     Array.from({length:factors},(_,i)=>({id:i===0?factorId:admin,status:'verified'}))
    },error:null};},
    challengeAndVerify:async ({factorId:id,code})=>{
     events.push(['mfa',id,code]);level='aal2';return {error:null};
    }
   }
  },
  from:table=>{events.push(['from',table]);return {
   select:()=>({eq:()=>({limit:async n=>{
    events.push(['limit',n]);return {data:role===null?[]:
     (Array.isArray(role)?role:[role]).map(role=>({role})),
     error:roleError};
   }})})
  };}
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
test('G75 Admin session requires real getUser, verified TOTP, AAL2 and single RLS admin role',async()=>{
 const f=fixture(),identity=await f.auth.readSession();
 assert.equal(identity.role,'admin');assert.equal(identity.subject,admin);
 assert.equal(identity.mfaVerified,true);
 assert.deepEqual(f.events.at(-1),['limit',3]);
 assert.equal(JSON.stringify(identity).includes('password'),false);
});
test('Owner can read own finance but cannot inherit Admin role',async()=>{
 const f=fixture({role:'owner'}),session=await f.auth.readSession();
 assert.equal(session.role,'owner');
});
test('Password or browser role without AAL2 never unlocks Admin; no TOTP/dual role/IdP means no data',async()=>{
 for(const settings of [
  {aal:'aal1'},{factors:0},{factors:2},{role:'driver'},
  {role:'passenger'},{role:['admin','owner']},{confirmed:false},
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
test('Missing TOTP enrollment rejects and revokes browser identity; bad code never calls provider',async()=>{
 const f=fixture({aal:'aal1',factors:0});
 assert.equal((await f.auth.signIn('admin@example.com','SecurePassword123')).code,
  'MFA_ENROLLMENT_REQUIRED');
 assert.equal(f.events.at(-1),'logout');
 const v=fixture();
 assert.equal((await v.auth.verifyTotp('000000000')).code,'INVALID_TOTP');
 assert.equal(v.events.length,0);
});
test('Remote logout must run, never persist browser token',async()=>{
 const f=fixture();
 await f.auth.signOut();
 assert.deepEqual(f.events,['logout']);
});
