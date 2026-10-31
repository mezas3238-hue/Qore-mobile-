import test from 'node:test';
import assert from 'node:assert/strict';
import {probeG271StagingServiceKey} from './g271-supabase-service-key-readonly-probe.mjs';
const ref='mrjzxftsdxzepzbcuids';
const secret='sb_secret_abcdefghijklmnopqrstuvwxyz1234567890';
const jwt=[
 Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
 Buffer.from(JSON.stringify({role:'service_role',ref})).toString('base64url'),
 'a'.repeat(43)
].join('.');
function fake(status,expected){
 let calls=0;
 return {calls:()=>calls,request:async(url,opts)=>{
  calls++;
  assert.equal(url,'https://'+ref+'.supabase.co/rest/v1/');
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'error');
  assert.equal(opts.headers.apikey,expected);
  assert.equal(opts.headers.Accept,'application/openapi+json');
  assert.equal(Object.hasOwn(opts.headers,'Authorization'),false);
  assert.equal(url.includes(expected),false);
  assert.equal(typeof opts.signal,'object');
  return {ok:status===200,status,redirected:false};
 }};
}
test('G271 modern server API key accepts exact provider 200 without metadata leakage',async()=>{
 const f=fake(200,secret);
 const result=await probeG271StagingServiceKey({ref,key:secret,request:f.request});
 assert.deepEqual(result,{validated:true,mode:'STAGING_ONLY'});
 assert.equal(f.calls(),1);
 assert.equal(JSON.stringify(result).includes(secret),false);
});
test('G271 legacy service_role JWT authenticates with apikey, not fake bearer user',async()=>{
 const f=fake(200,jwt);
 const r=await probeG271StagingServiceKey({ref,key:jwt,request:f.request});
 assert.equal(r.validated,true);
 assert.equal(f.calls(),1);
});
test('G271 refuses wrong project, public key, garbage or JWT with nonservice role before network',async()=>{
 const fakeJWT=[jwt.split('.')[0],
  Buffer.from(JSON.stringify({role:'authenticated',ref})).toString('base64url'),
  jwt.split('.')[2]].join('.');
 const f=fake(200,secret);
 for(const [project,key] of [
  ['qdqrlgzlotnfdxzpacxs',secret],
  [ref,'sb_publishable_abcdefghijklmnopqrstuvwxy123456'],
  [ref,'sb_secret_short'],[ref,'not-secret'],[ref,fakeJWT],
  [ref,secret+'\n']
 ]){
  const r=await probeG271StagingServiceKey({ref:project,key,request:f.request});
  assert.equal(r.validated,false);
 }
 assert.equal(f.calls(),0);
});
test('G271 401/403/404/500/302 and response redirect cannot count as acceptance',async()=>{
 for(const status of [0,301,302,401,403,404,429,500,503]){
  const f=fake(status,secret);
  assert.equal((await probeG271StagingServiceKey({
   ref,key:secret,request:f.request})).validated,false);
  assert.equal(f.calls(),1);
 }
 const redirected=await probeG271StagingServiceKey({
  ref,key:secret,request:async()=>({
   status:200,ok:true,redirected:true
  })
 });
 assert.equal(redirected.validated,false);
});
test('G271 timeout, invalid response and secret-bearing thrown errors are never surfaced',async()=>{
 for(const f of [
  async()=>{throw Error('private credential '+secret);},
  async()=>null,
  async()=>({ok:true,status:200,redirected:false,
   body:{cancel:async()=>{throw Error('secret stream')}}})
 ]){
  const result=await probeG271StagingServiceKey({ref,key:secret,request:f});
  assert.equal(JSON.stringify(result).includes(secret),false);
 }
 assert.equal((await probeG271StagingServiceKey({
  ref,key:secret,request:async()=>{throw Error(secret);}
 })).validated,false);
});
