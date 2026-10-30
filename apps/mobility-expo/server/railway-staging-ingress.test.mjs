import test from 'node:test';
import assert from 'node:assert/strict';
import {request as requestHttp} from 'node:http';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRenderStagingIngress} from './render-staging-ingress.mjs';
import {resolveQoreCloudStagingConfig} from './g4-cloud-staging-launcher.mjs';
const host='qore-staging-up-123.up.railway.app';
const renderHost='qore-staging.onrender.com';
const readinessKey='operator_key_for_staging_health_railway_2026_012345678';
const auth='Bearer stg-railway-test-auth-012345678901234567';
const valid={
 QORE_RAILWAY_STAGING_APPROVED:'true',
 QORE_RAILWAY_NO_COMMERCIAL_TRIPS:'true',
 QORE_MOBILITY_ENV:'staging',LIVE_TRIPS_ENABLED:'false',
 RAILWAY_ENVIRONMENT_NAME:'staging',PORT:'8080',QORE_RAILWAY_HOSTNAME:host,
 QORE_STAGING_READINESS_KEY:readinessKey
};
async function testIngress(options,run){
 const server=createRenderStagingIngress({loopbackOrigin:'http://127.0.0.1:50004',
  expectedHost:host,edgeProvider:'railway',...options});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;
 const req=({hostname=host,proto='https',path='/v1/staging/rider/history',
  method='GET',bearer=auth,origin,readinessKey:readiness}={})=>new Promise((resolve,reject)=>{
  const request=requestHttp('http://127.0.0.1:'+port+path,{
   method,headers:{host:hostname,'x-forwarded-proto':proto,connection:'close',
    ...(bearer===null?{}:{authorization:bearer}),
    ...(origin?{origin}:{}),
    ...(readiness?{'x-qore-readiness-key':readiness}:{})}
  },res=>{
   const chunks=[];res.on('data',x=>chunks.push(x));
   res.on('end',()=>resolve({status:res.statusCode,
    body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
  });
  request.on('error',reject);request.end();
 });
 try{await run(req);}finally{await new Promise(ok=>server.close(ok));}
}
test('Railway is a distinct pinned-host cloud, never an arbitrary forwarded host',()=>{
 for(const [edgeProvider,expectedHost] of [
  ['render',host],['railway',renderHost],['railway','bad.up.railway.app.evil.test'],
  ['railway','localhost'],['unsafe',host]
 ])assert.throws(()=>createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:50004',edgeProvider,expectedHost
 }));
});
test('Railway staging startup forbids production, absent consent and LIVE trips',()=>{
 assert.equal(resolveQoreCloudStagingConfig('railway',valid).hostname,host);
 for(const overrides of [
  {RAILWAY_ENVIRONMENT_NAME:'production'},
  {RAILWAY_ENVIRONMENT_NAME:undefined},
  {QORE_RAILWAY_STAGING_APPROVED:'false'},
  {LIVE_TRIPS_ENABLED:'true'},
  {QORE_RAILWAY_NO_COMMERCIAL_TRIPS:'false'},
  {QORE_RAILWAY_HOSTNAME:renderHost},
  {QORE_STAGING_READINESS_KEY:'too-short'},
  {QORE_EDGE_MAX_WRITES:'1025'}
 ]){
  const env={...valid,...overrides};
  assert.throws(()=>resolveQoreCloudStagingConfig('railway',env));
 }
 assert.throws(()=>resolveQoreCloudStagingConfig('railway',{
  ...valid,QORE_STAGING_READINESS_KEY:valid.QORE_STAGING_SERVICE_ROLE_KEY,
  QORE_STAGING_SERVICE_ROLE_KEY:readinessKey
 }));
});
test('Render keeps its independent approval: Railway approval is not transferable',()=>{
 const ren={...valid,QORE_RENDER_HOSTNAME:renderHost,
  QORE_RENDER_NO_COMMERCIAL_TRIPS:'true'};
 assert.throws(()=>resolveQoreCloudStagingConfig('render',ren));
 assert.equal(resolveQoreCloudStagingConfig('render',{
  ...ren,QORE_RENDER_STAGING_APPROVED:'true'
 }).hostname,renderHost);
});
test('Railway ingress forwards only authorized HTTPS native/Driver/Admin operations',async()=>{
 let calls=0;
 await testIngress({request:async(url,opts)=>{
  calls++;
  assert.match(url,/^http:\/\/127\.0\.0\.1:50004\/v1\/staging\//);
  assert.equal(opts.headers.authorization,auth);
  return new Response('{"tripId":"original-id","commercial":false}',{status:200});
 }},async req=>{
  const ok=await req();assert.equal(ok.status,200);
  assert.equal(ok.body.tripId,'original-id');
  for(const opts of [
   {hostname:'qore-prod.up.railway.app'},{hostname:renderHost},
   {proto:'http'},{bearer:null},{origin:'https://untrusted.example'},
   {path:'/v1/staging/rider/history?mode=unsafe'}
  ])assert.notEqual((await req(opts)).status,200);
  assert.equal(calls,1);
 });
});
test('Railway /_qore liveness never asserts E2E readiness, readiness is private',async()=>{
 await testIngress({readinessKey,readinessProbe:async()=>true,
  request:async()=>{throw Error('never forward health');}},async req=>{
  const up=await req({path:'/_qore/liveness',bearer:null});
  assert.deepEqual(up.body,{state:'PROCESS_UP_ONLY',commercialRidesEnabled:false});
  const unauth=await req({path:'/_qore/readiness',bearer:null});
  assert.equal(unauth.status,404);
  const ok=await req({path:'/_qore/readiness',bearer:null,readinessKey});
  assert.equal(ok.status,200);
  assert.deepEqual(ok.body,{state:'INFRASTRUCTURE_READY_ONLY',
   stagingE2ECertified:false,commercialRidesEnabled:false});
 });
});
test('Railway starter refuses running in production before reading secrets',()=>{
 const runner=fileURLToPath(new URL('./run-g4-railway-staging.mjs',import.meta.url));
 const child=spawnSync(process.execPath,[runner],{
  encoding:'utf8',timeout:5000,
  env:{PATH:process.env.PATH??'/usr/bin',...valid,RAILWAY_ENVIRONMENT_NAME:'production'}
 });
 assert.notEqual(child.status,0);
 assert.match(child.stderr,/explicit non-commercial owner authorization/);
 assert.doesNotMatch(child.stdout,/started|token|secret/);
});
