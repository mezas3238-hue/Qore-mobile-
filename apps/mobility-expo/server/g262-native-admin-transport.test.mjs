import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
const ORIGINAL='26200000-0000-4262-8262-000000000003';
const kinds=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'];
const API='/v1/staging/admin/native-services/';
const TOKEN='g262-synthetic-only-bearer-00000000000000000001';
const noop=async()=>({status:503,body:{error:'not mounted'}});
const makeServer=handler=>createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,
 deliveryOfferHandler:noop,
 ...(handler===undefined?{}:{adminNativeTraceHandler:handler})
});
const path=kind=>API+kind+'/'+ORIGINAL+'/trace';
async function withServer(handler,callback){
 const server=makeServer(handler);
 const base=await listenQoreRadarLoopback(server);
 try{return await callback(base);}
 finally{await new Promise(resolve=>server.close(resolve));}
}
test('G262 HTTP loopback preserves all five original IDs and bearer without source substitution',async()=>{
 const calls=[];
 await withServer(async input=>{
  calls.push(input);
  return {status:200,body:{
   originalId:ORIGINAL,actor:'synthetic-only',
   productionEnabled:false,externalEndToEndCertified:false
  }};
 },async base=>{
  for(const kind of kinds){
   const r=await fetch(base+path(kind),{
    headers:{authorization:'Bearer '+TOKEN}
   });
   assert.equal(r.status,200,kind);
   const data=await r.json();
   assert.equal(data.originalId,ORIGINAL);
   assert.equal(data.productionEnabled,false);
   assert.equal(data.externalEndToEndCertified,false);
  }
 });
 assert.equal(calls.length,5);
 for(let i=0;i<kinds.length;i++){
  assert.equal(calls[i].method,'GET');
  assert.equal(calls[i].path,path(kinds[i]));
  assert.equal(calls[i].headers.authorization,'Bearer '+TOKEN);
 }
});
test('G262 native Admin route refuses unconfigured runtime and never opens anonymously',async()=>{
 await withServer(undefined,async base=>{
  const r=await fetch(base+path('AUTO_RIDE'),{
   headers:{authorization:'Bearer '+TOKEN}
  });
  assert.equal(r.status,503);
  assert.match(JSON.stringify(await r.json()),/AAL2 unavailable/);
 });
});
test('G262 rejects unauthorized methods and forged URL path before handler',async()=>{
 let count=0;
 await withServer(async()=>{count++;return {status:200,body:{ok:true}};},async base=>{
  const attempts=[
   [path('AUTO_RIDE')+'?live=true','GET'],
   [path('EVIL'),'GET'],
   [path('AUTO_RIDE'),'POST']
  ];
  for(const [where,method] of attempts){
   const r=await fetch(base+where,{method,
    headers:{authorization:'Bearer '+TOKEN}});
   assert.equal(r.status,404);
  }
  const withBody=await fetch(base+path('AUTO_RIDE'),{
   method:'GET',headers:{
    authorization:'Bearer '+TOKEN,
    'content-length':'3'
   }
  });
  assert.equal(withBody.status,400);
 });
 assert.equal(count,0);
});
