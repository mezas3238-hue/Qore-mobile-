import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyThreeActorIsolation} from './staging-three-actors-readonly.mjs';

const ref='hylgkfgkcyrddokloljm';
const key='sb_publishable_abcdefghijklmnopqrstuvwxyz';
const ids=[
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333'
];
const fixtures=[
 {email:'qa-passenger@example.invalid',password:'synthetic-password-passenger-123',role:'passenger'},
 {email:'qa-driver-a@example.invalid',password:'synthetic-password-driver-a-123',role:'driver'},
 {email:'qa-driver-b@example.invalid',password:'synthetic-password-driver-b-123',role:'driver'}
];
function mock({leak=false,dualRole=false,confirmed=true}={}){
 const called=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url);called.push({path:u.pathname,method:options.method});
  if(u.pathname==='/auth/v1/token'){
   const body=JSON.parse(options.body);
   const i=fixtures.findIndex(f=>f.email===body.email&&f.password===body.password);
   if(i<0)return {ok:false,status:401};
   return {ok:true,json:async()=>({access_token:'faketoken-'+String(i).repeat(22)})};
  }
  const bearer=options.headers.Authorization?.replace(/^Bearer /,'');
  const caller=fixtures.findIndex((_,i)=>bearer==='faketoken-'+String(i).repeat(22));
  if(caller<0)throw Error('Fake JWT mismatch');
  if(u.pathname==='/auth/v1/user')return{
   ok:true,json:async()=>({
    id:ids[caller],email:fixtures[caller].email,
    email_confirmed_at:confirmed?'2026-10-18T00:00:00Z':null,is_anonymous:false
   })
  };
  if(u.pathname.startsWith('/rest/v1/')){
   const table=u.pathname.split('/').pop();
   const query=u.searchParams.get(table==='user_roles'?'user_id':'id');
   const who=ids.findIndex(id=>query==='eq.'+id);
   let rows=[];
   if(who>=0&&(who===caller||leak)){
    rows=table==='profiles'?[{id:ids[who]}]:
     [{user_id:ids[who],role:fixtures[who].role}];
    if(table==='user_roles'&&dualRole&&who===1)
     rows.push({user_id:ids[who],role:'passenger'});
   }
   return {ok:true,json:async()=>rows};
  }
  throw Error('Unexpected mock staging endpoint');
 };
 return {fetcher,called};
}
const base=(m,extra={})=>verifyThreeActorIsolation({
 ref,anonKey:key,fixtures,environment:'staging',liveTripsEnabled:false,
 signupGate:async()=>({certified:true}),
 fetcher:m.fetcher,...extra
});
test('three confirmed synthetic identities: own profile+single role, 12 foreign reads denied',async()=>{
 const m=mock();const result=await base(m);
 assert.deepEqual(result,{
  mode:'STAGING_ONLY',commercialRidesEnabled:false,
  verified:true,accountsVerified:3,rolesVerified:['passenger','driver','driver'],
  foreignAccessDenied:true
 });
 assert.equal(m.called.filter(x=>x.path==='/auth/v1/token').length,3);
 assert.equal(m.called.filter(x=>x.path==='/auth/v1/user').length,3);
 assert.equal(m.called.filter(x=>x.path.startsWith('/rest/v1/')).length,18);
 assert.equal(m.called.some(x=>x.method!=='GET'&&x.path!=='/auth/v1/token'),false);
});
test('native signup policy must be certified before any password login',async()=>{
 const m=mock();
 await assert.rejects(base(m,{signupGate:async()=>({certified:false})}),/disable_signup/);
 assert.equal(m.called.length,0);
});
test('detects forbidden cross-account profile or role read, no false green',async()=>{
 await assert.rejects(base(mock({leak:true})),/CRITICAL/);
});
test('rejects accidental passenger+driver dual-role and prevents admin promotion',async()=>{
 await assert.rejects(base(mock({dualRole:true})),/role incorrect/);
});
test('rejects unconfirmed Auth user before any protected REST access',async()=>{
 const m=mock({confirmed:false});
 await assert.rejects(base(m),/confirmed synthetic Auth/);
 assert.equal(m.called.some(x=>x.path.startsWith('/rest/v1/')),false);
});
test('fails closed for production env, LIVE enabled, old backend, service key and duplicate accounts',async()=>{
 for(const extra of [
  {environment:'production'}, {liveTripsEnabled:true},
  {ref:'qdqrlgzlotnfdxzpacxs'}, {anonKey:'sb_secret_abcdefghijklmnopqrstuvwxyz'},
  {fixtures:[fixtures[0],fixtures[1],fixtures[1]]},
  {fixtures:[{...fixtures[0],email:'real@gmail.com'},...fixtures.slice(1)]}
 ])await assert.rejects(base(mock(),extra));
});
