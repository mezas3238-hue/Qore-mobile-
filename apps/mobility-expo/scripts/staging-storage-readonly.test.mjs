import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFixturePath,assertDistinctFixtures,authLogin,verifyStorageIsolation} from './staging-storage-readonly.mjs';
const ref='staging1234567890abcd';
const key='sb_publishable_abcdefghijklmnopqrstuvwxyz';
const aId='11111111-1111-4111-8111-111111111111';
const bId='22222222-2222-4222-8222-222222222222';
const a={id:aId,token:'a'.repeat(50)};
const b={id:bId,token:'b'.repeat(50)};
const pathA=aId+'/licencia-SYNTHETICAAA1.png';
const pathB=bId+'/licencia-SYNTHETICBBB2.jpg';
const endpoint='https://'+ref+'.supabase.co';
function contract(overrides={}){
 const seen=[];
 const request=async(url,opts)=>{
  seen.push({url,method:opts.method,headers:opts.headers});
  assert.equal(opts.method,'GET');
  assert.ok(url.startsWith(endpoint+'/storage/v1/object/authenticated/mobility-staging-driver-evidence/'));
  const path=url.slice((endpoint+'/storage/v1/object/authenticated/mobility-staging-driver-evidence/').length);
  const token=opts.headers.authorization?.replace('Bearer ','');
  const status=(token===a.token&&path===pathA)||(token===b.token&&path===pathB)?200:403;
  return {status:overrides.status??status,body:{cancel:async()=>{}}};
 };
 return {request,seen};
}
test('fixture IDs must be distinct real UUID shapes',()=>{
 assert.equal(assertDistinctFixtures(a,b),true);
 assert.throws(()=>assertDistinctFixtures(a,{...b,id:aId}));
 assert.throws(()=>assertDistinctFixtures({...a,id:'not-an-uuid'},b));
});
test('requires clearly synthetic allowed object names in own UUID folder',()=>{
 assert.equal(assertFixturePath(pathA,aId),pathA);
 for(const p of [
  bId+'/licencia-SYNTHETICAAA1.png',
  aId+'/licencia-short.jpg',
  aId+'/licencia-SYNTHETICAAA1.svg',
  aId+'/nested/licencia-SYNTHETICAAA1.png',
  '../'+pathA,
  'driver-docs/'+pathA,
  aId+'/DNI-documento-real.png'
 ])assert.throws(()=>assertFixturePath(p,aId),p);
});
test('with two valid fixtures tests two own downloads, foreign isolation and anonymous denial',async()=>{
 const {request,seen}=contract();
 const r=await verifyStorageIsolation({ref,key,fixtureA:a,fixtureB:b,pathA,pathB,request});
 assert.deepEqual(r,{certified:true,ownReads:2,deniedCrossAndAnonymous:4,
  usedSyntheticFixturesOnly:true,liveTripsEnabled:false,hasWrites:false});
 assert.equal(seen.length,6);
 assert.ok(seen.every(call=>call.method==='GET'));
 assert.ok(seen.every(call=>!String(call.url).includes('qdqrlgzlotnfdxzpacxs')));
});
test('falsely green 404-for-everyone is rejected: own objects MUST exist',async()=>{
 const {request}=contract({status:404});
 await assert.rejects(
  verifyStorageIsolation({ref,key,fixtureA:a,fixtureB:b,pathA,pathB,request}),
  /deben existir/
 );
});
test('foreign or anonymous 200 triggers a hard failure even when both own objects work',async()=>{
 const {request}=contract();
 const bypass=async(url,opts)=>{
  const outcome=await request(url,opts);
  if(opts.headers.authorization?.includes(a.token)&&url.endsWith(pathB))return {...outcome,status:200};
  return outcome;
 };
 await assert.rejects(
  verifyStorageIsolation({ref,key,fixtureA:a,fixtureB:b,pathA,pathB,request:bypass}),
  /Fuga Storage/
 );
});
test('rejects production ref and malformed/superuser keys before calling any network',async()=>{
 let calls=0;
 const request=async()=>{calls++;throw Error('network should not be called')};
 await assert.rejects(verifyStorageIsolation({ref:'qdqrlgzlotnfdxzpacxs',key,fixtureA:a,fixtureB:b,pathA,pathB,request}));
 await assert.rejects(verifyStorageIsolation({ref,key:'sb_secret_supersecret_123456789',fixtureA:a,fixtureB:b,pathA,pathB,request}));
 assert.equal(calls,0);
});
test('fixture email Auth login enforces test-domain, confirmed user and verifies token at server',async()=>{
 const email='passenger-a@qore-staging.invalid',pw='local-test-only-password';
 const accesses=[];
 const request=async(url,opts)=>{
  accesses.push({url,method:opts.method,auth:opts.headers.authorization??null});
  if(url.endsWith('/token?grant_type=password'))
   return {ok:true,json:async()=>({access_token:'u'.repeat(50)})};
  if(url.endsWith('/user'))
   return {ok:true,json:async()=>({id:aId,email,email_confirmed_at:'2026-10-17T00:00:00Z'})};
  throw Error('Wrong endpoint');
 };
 const r=await authLogin(endpoint,key,email,pw,request);
 assert.deepEqual(r,{id:aId,token:'u'.repeat(50)});
 assert.deepEqual(accesses.map(a=>a.method),['POST','GET']);
 assert.ok(accesses[1].auth.startsWith('Bearer '));
 await assert.rejects(authLogin(endpoint,key,'real@company.com',pw,request));
});
