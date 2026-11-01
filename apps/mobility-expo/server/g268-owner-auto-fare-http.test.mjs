/** G268 exact HTTP loopback dispatch, no Supabase, keys, external services or LIVE. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';

const path='/v1/staging/owner/auto-fares/ASUNCION_FIXTURE';
const noop=async()=>({status:503,body:{error:'not configured'}});
const setup=handler=>createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,
 deliveryOfferHandler:noop,
 ...(handler?{ownerAutoFareHandler:handler}:{})
});
async function withServer(handler,run){
 const server=setup(handler),base=await listenQoreRadarLoopback(server);
 try{return await run(base);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('G268 transport routes POST JSON to configured private Owner handler and never adds CORS',async()=>{
 const calls=[],payload={
  requestKey:'00000000-0000-4000-8000-000000000900',
  basePyg:8000,perKmPyg:1000,perMinutePyg:200,
  minimumPyg:10000,commissionBps:1800
 };
 await withServer(async scope=>{
  calls.push(scope);
  return {status:200,body:{mode:'STAGING_DEMO_ONLY',
   commercialEnabled:false,acceptedBySyntheticHandler:true}};
 },async base=>{
  const r=await fetch(base+path,{method:'POST',
   headers:{'content-type':'application/json',
    authorization:'Bearer synthetic-not-real-token-00000000000'},
   body:JSON.stringify(payload)});
  assert.equal(r.status,200);
  assert.equal((await r.json()).commercialEnabled,false);
  assert.equal(r.headers.get('access-control-allow-origin'),null);
 });
 assert.equal(calls.length,1);
 assert.equal(calls[0].path,path);
 assert.equal(calls[0].method,'POST');
 assert.deepEqual(calls[0].body,payload);
});
test('G268 HTTP does not publish a fare when no Owner provider AAL2 handler exists',async()=>{
 await withServer(undefined,async base=>{
  const r=await fetch(base+path,{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({requestKey:'anything'})});
  assert.equal(r.status,503);
  assert.match(JSON.stringify(await r.json()),/G268 Owner AUTO tariff disabled/);
 });
});
test('G268 HTTP rejects wrong method, query-string bypass and non-JSON body before the private handler',async()=>{
 let called=0;
 await withServer(async()=>{called++;return {status:200,body:{ok:true}};},async base=>{
  for(const [where,method,headers] of [
   [path,'GET',{}],
   [path+'?live=true','POST',{'content-type':'application/json'}],
   [path,'POST',{'content-type':'text/plain'}],
   ['/v1/staging/owner/auto-fares/INVALID-zone','POST',{'content-type':'application/json'}]
  ]){
   const r=await fetch(base+where,{
    method,headers,...(method==='POST'?{body:'{}'}:{})
   });
   assert.notEqual(r.status,200);
  }
 });
 assert.equal(called,0);
});
