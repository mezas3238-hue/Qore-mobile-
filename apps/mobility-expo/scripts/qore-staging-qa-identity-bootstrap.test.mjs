import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapQa,verifyManifest,assertStage,QA_SLOTS,STAGING_REF} from './qore-staging-qa-identity-bootstrap.mjs';
const publicKey='sb_publishable_'+('a'.repeat(40));
const secret='sb_secret_'+('b'.repeat(45));
const uuids=QA_SLOTS.map((_,i)=>String(i+1).padStart(8,'0')+'-1111-4111-8111-'+String(i+1).padStart(12,'0'));
const manifest=QA_SLOTS.map(([slot,role],i)=>({slot,role,email:'qa-'+slot+'@example.invalid',password:'strong-synthetic-only-passphrase-'+i+'-XXXX'}));
const ctx={ref:STAGING_REF,environment:'staging',liveTripsEnabled:'false',publicKey,secret,manifest};
function mock({signup=true,users=[],wrongTrigger=false,failedAt=null}={}){
 const saved=new Map(),roles=new Map(),calls=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url),method=options.method;
  calls.push({path:u.pathname,method,query:u.search});
  if(failedAt===u.pathname)return {ok:false,status:503};
  if(u.pathname==='/auth/v1/admin/users'&&method==='GET')
   return {ok:true,status:200,json:async()=>({users})};
  if(u.pathname==='/auth/v1/admin/users'&&method==='POST'){
   const v=JSON.parse(options.body);
   if(!v.email_confirm||v.app_metadata?.qore_stage_qa!==true)throw Error('missing QA tags');
   const i=manifest.findIndex(x=>x.email===v.email);
   const id=uuids[i];saved.set(id,v);roles.set(id,wrongTrigger?'driver':'passenger');
   return {ok:true,status:201,json:async()=>({user:{id,email:v.email}})};
  }
  if(u.pathname==='/rest/v1/user_roles'&&method==='GET'){
   const id=u.searchParams.get('user_id').slice(3);
   return {ok:true,status:200,json:async()=>[{user_id:id,role:roles.get(id)}]};
  }
  if(u.pathname==='/rest/v1/user_roles'&&method==='PATCH'){
   const id=u.searchParams.get('user_id').slice(3);
   if(u.searchParams.get('role')!=='eq.passenger')throw Error('Role change not fenced');
   roles.set(id,JSON.parse(options.body).role);
   return {ok:true,status:200,json:async()=>[{user_id:id,role:roles.get(id)}]};
  }
  throw Error('Unexpected path: '+u.pathname);
 };
 return {fetcher,calls,saved};
}
const run=(m,opts={})=>bootstrapQa({...ctx,fetcher:m.fetcher,signupGate:async()=>({certified:true}),...opts});
test('all eight profiles are unique, email synthetic, roles exclusive and passwords distinct',()=>{
 assert.equal(verifyManifest(manifest).length,8);
 assert.throws(()=>verifyManifest(manifest.map((x,i)=>i===3?{...x,email:manifest[0].email}:x)),/Invalid/);
 assert.throws(()=>verifyManifest(manifest.map((x,i)=>i===2?{...x,password:'short'}:x)),/Invalid/);
 assert.throws(()=>verifyManifest(manifest.slice(1)),/Exactly eight/);
});
test('wrong production reference, LIVE or invalid public/private secrets fail',()=>{
 for(const vals of [
  {ref:'qdqrlgzlotnfdxzpacxs'},
  {environment:'production'},
  {liveTripsEnabled:'true'},
  {secret:publicKey},
  {publicKey:secret}
 ])assert.throws(()=>assertStage({...ctx,...vals}));
});
test('signup must be independently disabled before querying Auth admin',async()=>{
 const m=mock();
 await assert.rejects(run(m,{signupGate:async()=>({certified:false})}),/disable_signup/);
 assert.equal(m.calls.length,0);
});
test('existing Auth account, even QA, stops any new creation',async()=>{
 const m=mock({users:[{id:uuids[0]}]});
 await assert.rejects(run(m),/manual audit/);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,0);
});
test('eight identities created with confirmed email and audited role transitions',async()=>{
 const m=mock(),r=await run(m);
 assert.equal(r.count,8);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,8);
 assert.equal(m.calls.filter(c=>c.method==='PATCH').length,4);
 assert.equal(m.saved.size,8);
 assert(m.calls.every(c=>c.path.startsWith('/auth/v1/admin/users')||c.path==='/rest/v1/user_roles'));
});
test('unexpected signup trigger role or API failure fail closed',async()=>{
 await assert.rejects(run(mock({wrongTrigger:true})),/Unexpected trigger/);
 await assert.rejects(run(mock({failedAt:'/auth/v1/admin/users'})),/STAGING QA API failed/);
});
