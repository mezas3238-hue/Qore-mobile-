import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1StagingConnectivityProbe} from './f1-staging-connectivity.mjs';
const ORIGIN='https://movete-facil-staging.onrender.com';
const json=(value,status=200,contentType='application/json')=>
 new Response(JSON.stringify(value),{status,headers:{'content-type':contentType}});
const processOnly={state:'PROCESS_UP_ONLY',commercialRidesEnabled:false};

test('Cliente reaches the exact pinned Render process by HTTPS without JWT/PII',async()=>{
 const calls=[];
 const probe=createF1StagingConnectivityProbe({
  origin:ORIGIN,pinnedOrigin:ORIGIN,
  fetchImpl:async(url,init)=>{calls.push({url,init});return json(processOnly);}
 });
 assert.equal(probe.isConfigured(),true);
 const result=await probe.check();
 assert.deepEqual(result,{ok:true,code:'STAGING_PROCESS_REACHABLE',
  state:'PROCESS_UP_ONLY',commercialReady:false});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,ORIGIN+'/_qore/liveness');
 assert.equal(calls[0].init.method,'GET');
 assert.equal(calls[0].init.credentials,'omit');
 assert.equal(calls[0].init.redirect,'error');
 assert.deepEqual(calls[0].init.headers,{Accept:'application/json'});
 assert.equal(calls[0].init.body,undefined);
 assert.equal(JSON.stringify(calls).includes('Bearer'),false);
});

test('Cliente cannot contact unpinned / redirected / insecure / non-Render endpoints',async()=>{
 let calls=0;
 for(const input of [
  {origin:'http://movete-facil-staging.onrender.com',pinnedOrigin:ORIGIN},
  {origin:'https://example.org',pinnedOrigin:'https://example.org'},
  {origin:'https://movete-facil-staging.onrender.com/extra',pinnedOrigin:ORIGIN},
  {origin:'https://a:pass@movete-facil-staging.onrender.com',pinnedOrigin:ORIGIN},
  {origin:ORIGIN,pinnedOrigin:'https://other.onrender.com'},
  {origin:ORIGIN,pinnedOrigin:undefined}
 ]){
  const probe=createF1StagingConnectivityProbe({
   ...input,fetchImpl:async()=>{calls++;return json(processOnly);}
  });
  assert.equal(probe.isConfigured(),false);
  assert.equal((await probe.check()).code,'STAGING_ORIGIN_NOT_CONFIGURED');
 }
 assert.equal(calls,0);
});

test('Cliente never labels Render process health as database/dispatch readiness',async()=>{
 for(const invalid of [
  {state:'LIVE_READY',commercialRidesEnabled:true},
  {state:'PROCESS_UP_ONLY',commercialRidesEnabled:true},
  {state:'PROCESS_UP_ONLY',commercialRidesEnabled:false,tripReady:true},
  {state:'READY',commercialRidesEnabled:false},
  {state:'PROCESS_UP_ONLY'},
  null
 ]){
  const p=createF1StagingConnectivityProbe({origin:ORIGIN,pinnedOrigin:ORIGIN,
   fetchImpl:async()=>json(invalid)});
  assert.equal((await p.check()).ok,false,JSON.stringify(invalid));
 }
});

test('Cliente rejects bad HTTPS response, MIME, oversized content or non-JSON',async()=>{
 const cases=[
  ()=>json(processOnly,503),
  ()=>json(processOnly,200,'text/html'),
  ()=>new Response('not-json',{status:200,headers:{'content-type':'application/json'}}),
  ()=>new Response('x'.repeat(3000),{status:200,headers:{'content-type':'application/json'}})
 ];
 for(const make of cases){
  const p=createF1StagingConnectivityProbe({origin:ORIGIN,pinnedOrigin:ORIGIN,
   fetchImpl:async()=>make()});
  assert.equal((await p.check()).ok,false);
 }
});

test('Cliente serializes check and never treats network exception as success',async()=>{
 let complete;
 const p=createF1StagingConnectivityProbe({origin:ORIGIN,pinnedOrigin:ORIGIN,
  fetchImpl:()=>new Promise(resolve=>{complete=resolve;})});
 const first=p.check();
 assert.equal((await p.check()).code,'STAGING_CHECK_IN_PROGRESS');
 complete(json(processOnly));
 assert.equal((await first).ok,true);
 const broken=createF1StagingConnectivityProbe({origin:ORIGIN,pinnedOrigin:ORIGIN,
  fetchImpl:async()=>{throw Error('offline');}});
 assert.equal((await broken.check()).code,'STAGING_NETWORK_UNAVAILABLE');
});

test('G229 Cliente Railway liveness remains process-only and requires independent HTTPS pin',async()=>{
 const railway='https://qore-mobile-staging.up.railway.app';
 const good=createF1StagingConnectivityProbe({origin:railway,pinnedOrigin:railway,
  fetchImpl:async()=>json(processOnly)});
 assert.equal(good.isConfigured(),true);
 assert.equal((await good.check()).commercialReady,false);
 const wrong=createF1StagingConnectivityProbe({origin:railway,pinnedOrigin:ORIGIN});
 assert.equal(wrong.isConfigured(),false);
});
