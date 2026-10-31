import test from 'node:test';
import assert from 'node:assert/strict';
import {checkG258RailwayPublicBoundary}
 from './g258-railway-https-boundary-smoke.mjs';
const HOST='https://qore-mobile-backend-staging-staging.up.railway.app';
const ok=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json'}
});
const request=async url=>{
 if(url.endsWith('/_qore/liveness'))
  return ok(200,{state:'PROCESS_UP_ONLY',commercialRidesEnabled:false});
 if(url.endsWith('/v1/staging/driver/inbox'))
  return ok(401,{error:'Verified bearer required'});
 throw Error('no routes permitted');
};
test('G258 checks exactly one HTTPS Railway host, process and unauthenticated denial',async()=>{
 const calls=[];
 const report=await checkG258RailwayPublicBoundary({
  request:async (u,o)=>{calls.push([u,o]);return request(u);}
 });
 assert.equal(report.ok,true);
 assert.equal(report.processReachable,true);
 assert.equal(report.unauthenticatedAccessDenied,true);
 assert.equal(report.externallyCompletedJourneys,0);
 assert.equal(report.postgresTransactionChecked,false);
 assert.equal(report.productionReady,false);
 assert.deepEqual(calls.map(c=>c[0]),[
  HOST+'/_qore/liveness',HOST+'/v1/staging/driver/inbox'
 ]);
 assert.equal(calls.every(c=>c[1].method==='GET'&&
  c[1].credentials==='omit'&&c[1].redirect==='error'),true);
});
test('G258 never performs checks outside the pinned STAGING hostname',async()=>{
 for(const origin of [
  'http://qore-mobile-backend-staging-staging.up.railway.app',
  'https://qore-mobile-backend-staging-staging.up.railway.app.evil.tld',
  'https://qore-mobile-backend-staging-staging.up.railway.app:444',
  'https://another-service.up.railway.app',
  'https://qore-mobile-backend-staging-staging.up.railway.app/'
 ]){
  const r=await checkG258RailwayPublicBoundary({
   origin,request:async()=>{throw Error('must never fetch')}
  });
  assert.equal(r.code,'UNAUTHORIZED_STAGING_ORIGIN');
 }
});
test('G258 never certifies empty, malformed or commercial liveness',async()=>{
 for(const x of [
  {state:'PROCESS_UP_ONLY',commercialRidesEnabled:true},
  {state:'OK',commercialRidesEnabled:false},
  {state:'PROCESS_UP_ONLY',commercialRidesEnabled:false,pgCertified:true},
  {state:'PROCESS_UP_ONLY'},
 ]){
  const r=await checkG258RailwayPublicBoundary({
   request:async()=>ok(200,x)
  });
  assert.equal(r.ok,false);
  assert.equal(r.code,'LIVENESS_UNTRUSTED');
 }
});
test('G258 fails if unauthenticated HTTP is mistakenly accepted',async()=>{
 const r=await checkG258RailwayPublicBoundary({request:async url=>
  url.endsWith('/_qore/liveness')
   ?request(url):ok(200,{items:[]})});
 assert.equal(r.ok,false);
 assert.equal(r.code,'RAILWAY_UNREACHABLE_OR_UNTRUSTED');
});
test('G258 rejects oversized, HTML and network outage responses',async()=>{
 for(const impl of [
  async()=>new Response('A'.repeat(150000),{
   status:200,headers:{'content-type':'application/json'}}),
  async()=>new Response('<html>no</html>',{
   status:200,headers:{'content-type':'text/html'}}),
  async()=>{throw Error('private network details')}
 ]){
  const r=await checkG258RailwayPublicBoundary({request:impl});
  assert.equal(r.ok,false);
  assert.equal(r.code,'RAILWAY_UNREACHABLE_OR_UNTRUSTED');
  assert.equal(JSON.stringify(r).includes('private network details'),false);
 }
});
test('G258 bad process status blocks and never makes authenticated requests',async()=>{
 let count=0;
 const r=await checkG258RailwayPublicBoundary({request:async()=>{
  count++;return ok(502,{error:'unavailable'});
 }});
 assert.equal(count,1);
 assert.equal(r.ok,false);
});
