import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeDriverAuth} from './native-driver-auth.mjs';
import {verifyNativeDriverConfig} from './native-driver-config.mjs';
const driver='28280000-0000-4828-8828-000000000001';
const now=1900000000000;
function fixture({roles=['driver'],verifiedId=driver,sessionId=driver,
 confirmed=true,expired=false,loginError=null}={}){
 const calls=[];
 let eventListener=null;
 const client={
  auth:{
   getSession:async()=>({data:{session:{access_token:
    'driver-verified-token-abcdefghijklmnopqrstuvwxyz',
    expires_at:(expired?now-10000:now+300000)/1000,
    user:{id:sessionId}}},error:null}),
   getUser:async token=>{calls.push('remote-user');return {data:{user:{
    id:verifiedId,is_anonymous:false,
    email_confirmed_at:confirmed?'2026-10-24T00:00:00Z':null}},error:null};},
   signInWithPassword:async ({email,password})=>{
    calls.push(['login',email,password]);return {error:loginError};},
   signOut:async()=>{calls.push('sign-out');return {error:null};},
   onAuthStateChange:callback=>{
    eventListener=callback;
    return {data:{subscription:{unsubscribe:()=>calls.push('unsubscribed')}}};
   }
  },
  from:table=>{calls.push(['table',table]);return{
   select:()=>({eq:(col,id)=>({limit:async n=>{
    calls.push(['role-read',col,id,n]);return {data:roles.map(role=>({role})),error:null};
   }})})
  };}
 };
 return {auth:createNativeDriverAuth({supabase:client,now:()=>now}),
  calls,emit:()=>eventListener?.('SIGNED_IN',{})};
}
test('Driver native config rejects server secrets, HTTP and non-Supabase hosts',()=>{
 for(const bad of [
  {url:'http://staging1234567890abcd.supabase.co',publishableKey:'sb_publishable_abcdefghijabcdefghij'},
  {url:'https://example.org',publishableKey:'sb_publishable_abcdefghijabcdefghij'},
  {url:'https://staging1234567890abcd.supabase.co',publishableKey:'sb_secret_abcdefghijklmnopqrstuvwxyz'},
  {url:'https://staging1234567890abcd.supabase.co:8090',publishableKey:'sb_publishable_abcdefghijabcdefghij'}
 ])assert.equal(verifyNativeDriverConfig(bad).ok,false);
 assert.equal(verifyNativeDriverConfig({url:'https://staging1234567890abcd.supabase.co',
  publishableKey:'sb_publishable_abcdefghijabcdefghij'}).ok,true);
});
test('Driver native Auth online checks JWT identity and exactly one Driver role',async()=>{
 const f=fixture();
 const account=await f.auth.getSession();
 assert.deepEqual(account,{role:'driver',userId:driver,
  accessToken:'driver-verified-token-abcdefghijklmnopqrstuvwxyz'});
 assert(f.calls.includes('remote-user'));
 assert.deepEqual(f.calls.at(-1),['role-read','user_id',driver,3]);
});
test('Owner, Passenger, double role, expired JWT and unconfirmed account cannot masquerade as Driver',async()=>{
 for(const v of [{roles:['passenger']},{roles:['admin']},
  {roles:['driver','owner']},{roles:[]},{expired:true},
  {confirmed:false},{verifiedId:'another'},
  {sessionId:'28280000-0000-4828-8828-000000000002'}]){
  const f=fixture(v);
  assert.equal(await f.auth.getSession(),null,JSON.stringify(v));
 }
});
test('sign in with real Driver role only, denying mismatched role with revocation',async()=>{
 const allowed=fixture();
 assert.equal((await allowed.auth.signIn(' DRIVER@EXAMPLE.COM ','StrongPassword123')).ok,true);
 assert.deepEqual(allowed.calls[0],['login','driver@example.com','StrongPassword123']);
 const denied=fixture({roles:['passenger']});
 assert.equal((await denied.auth.signIn('d@example.com','StrongPassword123')).code,
  'DRIVER_ROLE_NOT_VERIFIED');
 assert.equal(denied.calls.at(-1),'sign-out');
});
test('invalid login does not call network and sign-out triggers external revocation',async()=>{
 const f=fixture();
 assert.equal((await f.auth.signIn('invalid','test')).code,'INVALID_CREDENTIALS');
 assert.deepEqual(f.calls,[]);
 await f.auth.signOut();
 assert.deepEqual(f.calls,['sign-out']);
});
test('auth listeners are isolated and unsubscribe without disclosing tokens',async()=>{
 const f=fixture();
 let count=0;
 const stop=f.auth.subscribe(()=>{count++;});
 f.emit();
 assert.equal(count,1);
 stop();
 assert.deepEqual(f.calls,['unsubscribed']);
});
