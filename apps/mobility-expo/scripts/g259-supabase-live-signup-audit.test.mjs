import test from 'node:test';
import assert from 'node:assert/strict';
import {auditG259Signup,G259_REF} from './g259-supabase-live-signup-audit.mjs';
const PUBLIC='sb_publishable_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHI';
const defaultOptions={
 projectRef:G259_REF,publishableKey:PUBLIC,
 signupReader:async()=>({certified:true,reason:'disable_signup=true'})
};
test('G259 confirms only live provider-disabled signup; no user or E2E claim',async()=>{
 let readCalls=0;
 const status=await auditG259Signup({...defaultOptions,
  request:async()=>{throw Error('test fake requester should not be reached')},
  signupReader:async({ref,key,request})=>{
   assert.equal(ref,G259_REF);
   assert.equal(key,PUBLIC);
   assert.equal(typeof request,'function');
   readCalls++;return {certified:true};
  }
 });
 assert.equal(readCalls,1);
 assert.deepEqual(status,{certified:true,code:'REAL_PROVIDER_SIGNUP_DISABLED',
  providerReadOnly:true,stage:'staging',commercialReady:false,
  externalJourneysCertified:0});
});
test('G259 denies wrong project and forged public key before any network call',async()=>{
 for(const p of [
  {projectRef:'qdqrlgzlotnfdxzpacxs'},
  {projectRef:'someotherstaging123456'},
  {publishableKey:'sb_secret_abcdefghijklmnopqrstuvwxy'},
  {publishableKey:undefined}
 ]){
  let wasCalled=false;
  const x=await auditG259Signup({...defaultOptions,...p,
   signupReader:async()=>{wasCalled=true;return {certified:true}}
  });
  assert.equal(x.certified,false);
  assert.equal(wasCalled,false);
 }
});
test('G259 explicitly blocks open signup, absent policy or unexpected API shape',async()=>{
 for(const result of [
  {certified:false,reason:'signup enabled'},{},
  null,{disable_signup:true}
 ]){
  const r=await auditG259Signup({...defaultOptions,
   signupReader:async()=>result});
  assert.equal(r.code,'PUBLIC_SIGNUP_NOT_CERTIFIED_CLOSED');
  assert.equal(r.certified,false);
 }
});
test('G259 reports genuinely open signup only with confirmed provider policy',async()=>{
 const r=await auditG259Signup({...defaultOptions,
  signupReader:async()=>({
   certified:false,reason:'Auth admite registro público (disable_signup=false)'
  })
 });
 assert.equal(r.certified,false);
 assert.equal(r.code,'PUBLIC_SIGNUP_CONFIRMED_OPEN');
 assert.equal(JSON.stringify(r).includes(PUBLIC),false);
});
test('G259 fails closed on timeout, HTTP error or provider exception, without leakage',async()=>{
 const r=await auditG259Signup({...defaultOptions,
  signupReader:async()=>{throw Error('credential-private-server-response')}
 });
 assert.equal(r.code,'PROVIDER_SETTINGS_UNAVAILABLE');
 assert.equal(JSON.stringify(r).includes('credential-private-server-response'),false);
 assert.equal(JSON.stringify(r).includes(PUBLIC),false);
});
test('G259 missing request adapter is never counted as verification',async()=>{
 const r=await auditG259Signup({...defaultOptions,request:null});
 assert.equal(r.code,'INVALID_AUDIT_ADAPTER');
});
