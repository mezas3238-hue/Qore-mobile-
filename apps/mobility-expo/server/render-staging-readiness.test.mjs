import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {createRenderStagingIngress} from './render-staging-ingress.mjs';

const host='movete-facil-staging.onrender.com';
const secret='staging_health_operator_credential_2026_test_only_123456';
const options={
 loopbackOrigin:'http://127.0.0.1:19001',
 expectedHost:host,readinessKey:secret
};
async function listen(server){
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 return 'http://127.0.0.1:'+server.address().port;
}
async function req(base,{path='/ _qore/readiness'.replace(' ',''),method='GET',headers={}}={}){
 return new Promise((resolve,reject)=>{
  const r=httpRequest(base+path,{
   method,headers:{host,'x-forwarded-proto':'https',
    'x-qore-readiness-key':secret,connection:'close',...headers}
  },res=>{
   const chunks=[];
   res.on('data',c=>chunks.push(c));
   res.on('end',()=>{
    try{resolve({status:res.statusCode,headers:res.headers,
     body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}
    catch(e){reject(e);}
   });
  });
  r.on('error',reject);
  r.end();
 });
}
async function withIngress(overrides,run){
 const server=createRenderStagingIngress({...options,...overrides});
 const url=await listen(server);
 try{await run(url);}finally{await new Promise(ok=>server.close(ok));}
}
test('G229 readiness never forwards traffic or grants commercial authorization',async()=>{
 let calls=0;
 await withIngress({readinessProbe:async()=>{calls++;return true;},
  request:async()=>{throw Error('must not forward readiness');}},async url=>{
  const response=await req(url);
  assert.equal(response.status,200);
  assert.deepEqual(response.body,{
   state:'INFRASTRUCTURE_READY_ONLY',
   stagingE2ECertified:false,commercialRidesEnabled:false
  });
  assert.equal(response.headers['cache-control'],'no-store, private, max-age=0');
  assert.equal(calls,1);
 });
});
test('G229 blocks unauthorized, wrong host, HTTP, browser and non-GET probes',async()=>{
 let calls=0;
 await withIngress({readinessProbe:async()=>{calls++;return true;}},async url=>{
  for(const headers of [
   {'x-qore-readiness-key':'wrong'},
   {'x-qore-readiness-key':''},
   {'x-forwarded-proto':'http'},
   {host:'evil.onrender.com'},
   {origin:'https://movete-admin.example.org'},
   {cookie:'session=1'},
   {'x-forwarded-host':'evil.onrender.com'}
  ])assert.equal((await req(url,{headers})).status,404);
  assert.equal((await req(url,{method:'POST'})).status,404);
  assert.equal((await req(url,{path:'/_qore/readiness?mode=unsafe'})).status,404);
  assert.equal(calls,0,'invalid probes may not reach Supabase');
 });
});
test('G229 unavailable Auth/DB fails closed without exposing internal errors',async()=>{
 await withIngress({readinessProbe:async()=>{throw Error('sensitive Supabase failure');}},
  async url=>{
   const result=await req(url);
   assert.equal(result.status,503);
   assert.deepEqual(result.body,{
    state:'STAGING_UNAVAILABLE',stagingE2ECertified:false,
    commercialRidesEnabled:false
   });
   assert(!JSON.stringify(result.body).includes('Supabase'));
  });
 await withIngress({readinessProbe:async()=>false},async url=>
  assert.equal((await req(url)).status,503));
});
test('G229 coalesces simultaneous privileged probes rather than multiplying DB load',async()=>{
 let calls=0,release;
 const pending=new Promise(done=>{release=done;});
 await withIngress({readinessProbe:async()=>{calls++;await pending;return true;}},
  async url=>{
   const batch=Array.from({length:8},()=>req(url));
   await new Promise(r=>setTimeout(r,50));
   assert.equal(calls,1);
   release();
   const responses=await Promise.all(batch);
   assert(responses.every(x=>x.status===200));
  });
});
test('G229 requires private credential, never treats only a supplied probe as enabled',()=>{
 for(const overrides of [
  {readinessProbe:async()=>true,readinessKey:null},
  {readinessProbe:async()=>true,readinessKey:'short'},
  {readinessProbe:'yes'}
 ])assert.throws(()=>createRenderStagingIngress({...options,...overrides}));
});
