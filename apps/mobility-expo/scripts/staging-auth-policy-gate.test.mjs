import test from 'node:test';
import assert from 'node:assert/strict';
import {safeStageRef,assertPublishableKey,evaluateSignupPolicy,inspectStageSignup} from './staging-auth-policy-gate.mjs';
const ref='staging1234567890abcd';
const anon='sb_publishable_abcdefghijklmnopqrstuvwxyz';
const mock=(settings,status=200)=>
 async(url,opts)=>{
  assert.equal(url,'https://'+ref+'.supabase.co/auth/v1/settings');
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'error');
  assert.equal(opts.headers.apikey,anon);
  return {ok:status===200,status,json:async()=>settings};
 };
test('ref gate prohibits original production-like Lovable and malformed refs',()=>{
 for(const r of [null,'','qdqrlgzlotnfdxzpacxs','https://demo.com','abc','UPPERCASE'])
  assert.throws(()=>safeStageRef(r));
 assert.equal(safeStageRef(ref),ref);
});
test('credential gate rejects private secret, admin and foreign-scoped JWT',()=>{
 for(const k of ['','sb_secret_secret_only_value_123456789','service_role','not-a-key']){
  assert.throws(()=>assertPublishableKey(k,ref));
 }
 const jwt=(role,identity='staging1234567890abcd')=>
  ['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({role,ref:identity})).toString('base64url'),'a'.repeat(43)].join('.');
 assert.doesNotThrow(()=>assertPublishableKey(anon,ref));
 assert.doesNotThrow(()=>assertPublishableKey(jwt('anon'),ref));
 assert.throws(()=>assertPublishableKey(jwt('service_role'),ref));
 assert.throws(()=>assertPublishableKey(jwt('anon','otherstaging12345678'),ref));
});
test('unknown, false, string disable_signup must block — never infer invite-only',()=>{
 for(const s of [null,{},[],{disable_signup:false},{disable_signup:'true'},{disable_signup:1}]){
  assert.equal(evaluateSignupPolicy(s).certified,false);
 }
 assert.deepEqual(evaluateSignupPolicy({disable_signup:true}),{
  certified:true,reason:'Auth prohíbe registro público (disable_signup=true)'
 });
});
test('remote readonly probe fetches settings only and rejects disabled signup',async()=>{
 const a=await inspectStageSignup({ref,key:anon,request:mock({disable_signup:false})});
 assert.equal(a.certified,false);
 const b=await inspectStageSignup({ref,key:anon,request:mock({disable_signup:true})});
 assert.equal(b.certified,true);
});
test('remote probe fails closed on API errors or missing keys',async()=>{
 await assert.rejects(inspectStageSignup({ref,key:anon,request:mock({disable_signup:true},403)}));
 await assert.rejects(inspectStageSignup({ref,key:'sb_secret_not_public_1234567890',request:mock({})}));
});
