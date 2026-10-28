import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverStagingAuthAdapter,DRIVER_STAGING_AUTH_LIVE_ENABLED}
 from './driver-staging-auth.mjs';
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const token='a'.repeat(60),origin='http://127.0.0.1:4141';
const now=Date.parse('2026-10-22T12:00:00Z');
const user={id,email_confirmed_at:'2026-10-21T00:00:00Z',is_anonymous:false};
const session={user:{id},access_token:token,expires_at:Math.floor(now/1000)+600};
const rolePayload={
 mode:'STAGING_DEMO_ONLY',verificationScope:'CURRENT_LICENSE_REVIEW_ONLY',
 currentLicenseApproved:false,driverEligible:false,liveOperationsEnabled:false
};
function fixture({record=session,verified=user,roleStatus=200,roleBody=rolePayload}={}){
 const calls=[];
 let changeCallback;
 const auth={
  getSession:async()=>({data:{session:record},error:null}),
  getUser:async jwt=>{calls.push(['getUser',jwt]);return {
   data:{user:verified},error:null
  };},
  onAuthStateChange:listener=>{
   changeCallback=listener;
   return {data:{subscription:{unsubscribe:()=>calls.push(['unsubscribe'])}}};
  }
 };
 const request=async(url,options)=>{
  calls.push(['role',url,options]);return {
   status:roleStatus,json:async()=>roleBody
  };
 };
 return {auth,request,calls,change:()=>changeCallback?.('SIGNED_OUT',{
  access_token:'MUST_NOT_LEAK'
 })};
}
test('G22 requires independent SDK and localhost, no embedded Auth credentials',async()=>{
 assert.equal(DRIVER_STAGING_AUTH_LIVE_ENABLED,false);
 const f=fixture();
 const adapter=createDriverStagingAuthAdapter({
  auth:f.auth,apiOrigin:origin,request:f.request,now:()=>now
 });
 const value=await adapter.getSession();
 assert.deepEqual(value,{role:'driver',userId:id,accessToken:token});
 assert.ok(Object.isFrozen(value));
 assert.deepEqual(f.calls[0],['getUser',token]);
 assert.equal(f.calls[1][1],origin+'/v1/staging/driver/license-readiness');
 assert.equal(f.calls[1][2].headers.authorization,'Bearer '+token);
 assert.equal(f.calls[1][2].credentials,'omit');
 assert.equal(f.calls[1][2].cache,'no-store');
 assert.equal(f.calls.length,2);
});
test('G22 emits only change signal; logout clears via controller, never forwards session data',()=>{
 const f=fixture();
 const adapter=createDriverStagingAuthAdapter({
  auth:f.auth,apiOrigin:origin,request:f.request,now:()=>now
 });
 let notifications=0;
 const unsubscribe=adapter.subscribe((...args)=>{
  notifications++;
  assert.deepEqual(args,[]);
 });
 f.change();assert.equal(notifications,1);
 unsubscribe();assert.deepEqual(f.calls,[['unsubscribe']]);
});
test('G22 does not attempt network before valid SDK, origin and Auth session',async()=>{
 let fetched=0;
 const request=async()=>{fetched++;throw Error('Unexpected network')};
 for(const apiOrigin of [
  'https://api.example', 'http://localhost:4141',
  'http://0.0.0.0:4141','http://127.0.0.1:4141/path',
  'http://user:pass@127.0.0.1:4141',
  'http://127.0.0.1:4141/?driverId=private'
 ]){
  assert.throws(()=>createDriverStagingAuthAdapter({
   auth:fixture().auth,apiOrigin,request,now:()=>now
  }));
 }
 assert.throws(()=>createDriverStagingAuthAdapter({auth:{},apiOrigin:origin}));
 const empty=fixture({record:null});
 const out=await createDriverStagingAuthAdapter({
  auth:empty.auth,apiOrigin:origin,request,now:()=>now
 }).getSession();
 assert.equal(out,null);
 assert.equal(fetched,0);
});
test('G22 rejects expired/fake tokens, mismatched getUser and unconfirmed account',async()=>{
 for(const record of [
  {...session,expires_at:Math.floor(now/1000)+20},
  {...session,access_token:'wrong'},
  {...session,user:{id:'fake'}}
 ]){
  await assert.rejects(()=>createDriverStagingAuthAdapter({
   auth:fixture({record}).auth,apiOrigin:origin,
   request:fixture().request,now:()=>now
  }).getSession());
 }
 for(const verified of [
  {...user,id:other},
  {...user,email_confirmed_at:null},
  {...user,is_anonymous:true},
  {...user,id:'bad'}
 ]){
  const f=fixture({verified});
  await assert.rejects(()=>createDriverStagingAuthAdapter({
   auth:f.auth,apiOrigin:origin,request:f.request,now:()=>now
  }).getSession());
 }
});
test('G22 backend role and JWT validation must succeed, regardless of local metadata',async()=>{
 for(const roleStatus of [401,403,429,503]){
  const f=fixture({roleStatus});
  const adapter=createDriverStagingAuthAdapter({
   auth:f.auth,apiOrigin:origin,request:f.request,now:()=>now
  });
  await assert.rejects(()=>adapter.getSession());
 }
 const forged=fixture({roleBody:{...rolePayload,driverEligible:true}});
 await assert.rejects(()=>createDriverStagingAuthAdapter({
  auth:forged.auth,apiOrigin:origin,request:forged.request,now:()=>now
 }).getSession());
 const statusWithoutKyc=fixture({roleBody:{
  ...rolePayload,currentLicenseApproved:false
 }});
 assert.equal((await createDriverStagingAuthAdapter({
  auth:statusWithoutKyc.auth,apiOrigin:origin,request:statusWithoutKyc.request,
  now:()=>now
 }).getSession()).role,'driver',
 'not yet KYC approved is allowed to view status, not to accept rides');
});
test('G22 rejects session mismatch when Auth SDK verifier returns error',async()=>{
 const f=fixture();
 f.auth.getUser=async()=>({data:{user},error:{message:'revoked'}});
 await assert.rejects(()=>createDriverStagingAuthAdapter({
  auth:f.auth,apiOrigin:origin,request:f.request,now:()=>now
 }).getSession());
});
