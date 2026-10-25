import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePassengerAuth} from './native-passenger-auth.mjs';
import {verifyNativePassengerConfig} from './native-passenger-config.mjs';
const id='25250000-0000-4525-8525-000000000001';
const ms=1900000000000;
function fixture({roles=['passenger'],expire=ms+600000,
 anonymous=false,confirmed=true,userId=id,sessionId=id,
 verifyError=null,roleError=null,loginError=null}={}){
 let calls=[];
 const supabase={
  auth:{
   getSession:async()=>{calls.push('getSession');return {data:{session:{
    access_token:'verified-passenger-token-abcdefghijklmnopqrstuvwxyz',
    expires_at:expire/1000,user:{id:sessionId}}},error:null};},
   getUser:async token=>{calls.push('getUser');return {
    data:{user:{id:userId,is_anonymous:anonymous,
     email_confirmed_at:confirmed?'2026-10-24T12:00:00Z':null}},
    error:verifyError};},
   signInWithPassword:async args=>{calls.push(['signIn',args.email,args.password]);
    return {error:loginError};},
   signOut:async()=>{calls.push('signOut');return {error:null};}
  },
  from:table=>{calls.push(['from',table]);return {
   select:fields=>{calls.push(['select',fields]);return {
    eq:(field,val)=>{calls.push(['eq',field,val]);return {
     limit:async n=>{calls.push(['limit',n]);return {
      data:roles.map(role=>({role})),error:roleError
     };}
    };}
   };}
  };}
 };
 return {auth:createNativePassengerAuth({supabase,now:()=>ms}),calls};
}
test('native configuration rejects fake HTTP, server secrets, arbitrary host and credentials',()=>{
 for(const cfg of [
  {url:'http://staging1234567890abcd.supabase.co',publishableKey:'sb_publishable_abcdefghijabcdefghij'},
  {url:'https://example.org',publishableKey:'sb_publishable_abcdefghijabcdefghij'},
  {url:'https://staging1234567890abcd.supabase.co',publishableKey:'sb_secret_NOBROWSER098765432109'},
  {url:'https://user:pass@staging1234567890abcd.supabase.co',publishableKey:'sb_publishable_abcdefghijabcdefghij'},
  {url:'https://staging1234567890abcd.supabase.co:444',publishableKey:'sb_publishable_abcdefghijabcdefghij'},
  {url:'https://staging1234567890abcd.supabase.co',publishableKey:undefined}
 ])assert.equal(verifyNativePassengerConfig(cfg).ok,false);
 assert.equal(verifyNativePassengerConfig({
  url:'https://staging1234567890abcd.supabase.co',
  publishableKey:'sb_publishable_abcdefghijabcdefghij'
 }).ok,true);
});
test('verified remote Auth AND exact exclusive passenger role yields one private JWT session',async()=>{
 const f=fixture();
 const result=await f.auth.readSession();
 assert.equal(result.role,'passenger');
 assert.equal(result.subject,id);assert.equal(result.expiresAt,ms+600000);
 assert.equal(f.calls[0],'getSession');assert.equal(f.calls[1],'getUser');
 assert.deepEqual(f.calls.filter(x=>Array.isArray(x)&&x[0]==='from'),
  [['from','user_roles']]);
 assert.deepEqual(f.calls.at(-1),['limit',3]);
});
test('a valid JWT without exact RLS Passenger role cannot unlock Cliente',async()=>{
 for(const scenario of [
  {roles:['admin']},{roles:['owner']},{roles:['passenger','admin']},
  {roles:[]},{roleError:{code:'42501'}},{anonymous:true},
  {confirmed:false},{verifyError:{code:'401'}},{userId:'other'},
  {sessionId:'25250000-0000-4525-8525-000000000009'},
  {expire:ms-1000}
 ]){
  const f=fixture(scenario);
  assert.equal(await f.auth.readSession(),null,JSON.stringify(scenario));
 }
});
test('native signIn verifies role after credentials and revokes unauthorized Passenger',async()=>{
 const f=fixture({roles:['driver']});
 const result=await f.auth.signIn(' User@Example.com ','NoPersistentPassword123');
 assert.equal(result.code,'PASSENGER_ROLE_NOT_VERIFIED');
 assert.deepEqual(f.calls[0],
  ['signIn','user@example.com','NoPersistentPassword123']);
 assert.equal(f.calls.at(-1),'signOut');
 assert(!JSON.stringify(result).includes('NoPersistentPassword123'));
});
test('valid native signIn grants verified subject and invalid inputs never hit IdP',async()=>{
 const ok=fixture();
 assert.equal((await ok.auth.signIn('USER@example.com','SafePassword321')).subject,id);
 for(const args of [['bad','SafePassword321'],['u@example.com','x']]){
  const f=fixture();
  assert.equal((await f.auth.signIn(...args)).code,'INVALID_LOGIN_INPUT');
  assert.equal(f.calls.length,0);
 }
 const denied=fixture({loginError:{status:401}});
 assert.equal((await denied.auth.signIn('u@example.com','SafePassword321')).code,
  'INVALID_CREDENTIALS_OR_UNAVAILABLE');
 assert.equal(denied.calls.length,1);
});
test('signOut calls provider revocation and never stores credentials locally',async()=>{
 const f=fixture();
 await f.auth.signOut();
 assert.deepEqual(f.calls,['signOut']);
});
