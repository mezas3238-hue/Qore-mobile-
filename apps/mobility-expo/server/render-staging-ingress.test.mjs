import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as nativeHttpRequest} from 'node:http';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRenderStagingIngress} from './render-staging-ingress.mjs';

const host='movete-facil-staging.onrender.com';
const browser='https://movete-admin.example.org';
const token='staging-test-token-01234567890123456789';
async function listening(server){
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 return 'http://127.0.0.1:'+server.address().port;
}
async function withServers(callback){
 const calls=[];
 const backend=createServer(async(req,res)=>{
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  calls.push({method:req.method,path:req.url,
   auth:req.headers.authorization,origin:req.headers.origin,
   cursor:req.headers['x-qore-history-cursor'],
   body:Buffer.concat(chunks).toString('utf8')});
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({tripId:'same-verified-qa-trip',status:'searching',
   roleBound:req.headers.authorization===('Bearer '+token)}));
 });
 const local=await listening(backend);
 const ingress=createRenderStagingIngress({loopbackOrigin:local,
  expectedHost:host,adminOrigin:browser});
 try{
  const remote=await listening(ingress);
  await callback({remote,local,calls});
 }finally{
  await new Promise(resolve=>ingress.close(()=>resolve()));
  await new Promise(resolve=>backend.close(()=>resolve()));
 }
}
function doReq(base,path,{method='GET',authorization='Bearer '+token,
 headers={},body}={}){
 // Node fetch/undici rewrites Host to 127.0.0.1 for localhost targets.
 // Use raw Node HTTP so this explicitly verifies the Render Host pin.
 return new Promise((resolve,reject)=>{
  const req=nativeHttpRequest(base+path,{
   method,headers:{host,'x-forwarded-proto':'https',connection:'close',
    ...(body===undefined?{}:{'content-length':String(Buffer.byteLength(body))}),
    ...(authorization===null?{}:{authorization}),...headers}
  },res=>{
   const buffers=[];
   res.on('data',chunk=>buffers.push(chunk));
   res.once('error',reject);
   res.once('end',()=>resolve(new Response(
    res.statusCode===204?null:Buffer.concat(buffers),
    {status:res.statusCode,headers:res.headers}
   )));
  });
  req.once('error',reject);
  if(body!==undefined)req.write(body);
  req.end();
 });
}
test('Render ingress constructor requires pinned onrender host and fixed private loopback',()=>{
 for(const opts of [
  {loopbackOrigin:'http://evil.test:7000',expectedHost:host},
  {loopbackOrigin:'http://127.0.0.1:9000/secret',expectedHost:host},
  {loopbackOrigin:'http://127.0.0.1:9000',expectedHost:'localhost'},
  {loopbackOrigin:'http://127.0.0.1:9000',expectedHost:host,adminOrigin:'http://admin.test'},
  {loopbackOrigin:'http://127.0.0.1:9000',expectedHost:host,adminOrigin:'https://admin.test/a'}
 ])assert.throws(()=>createRenderStagingIngress(opts));
});
test('Native Client and Driver share exactly one loopback G4 backend with Bearer',async()=>{
 await withServers(async({remote,calls})=>{
  const quote=await doReq(remote,'/v1/staging/rider/auto/prequote',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({quoteRequestKey:'uuid-supplied-by-client'})});
  assert.equal(quote.status,200);
  assert.equal((await quote.json()).tripId,'same-verified-qa-trip');
  const driver=await doReq(remote,'/v1/staging/driver/offers/80800000-0000-4808-8808-000000000001');
  assert.equal(driver.status,200);
  assert.equal((await driver.json()).roleBound,true);
  assert.deepEqual(calls.map(x=>x.method),['POST','GET']);
  assert(calls.every(x=>x.auth==='Bearer '+token&&x.origin===undefined));
  assert.equal(calls[0].path,'/v1/staging/rider/auto/prequote');
 });
});
test('Render TLS and browser-origin pinning: no cookie, HTTP fallback or wrong host',async()=>{
 await withServers(async({remote,calls})=>{
  for(const headers of [
   {'x-forwarded-proto':'http'},
   {host:'evil.onrender.com'},
   {origin:'https://bad.example'},
   {cookie:'session=123'},
   {'proxy-authorization':'Bearer proxy-secret'},
   {'x-forwarded-host':'evil.onrender.com'}
  ]){
   const res=await doReq(remote,'/v1/staging/rider/history',{headers});
   assert.equal(res.status,403);
  }
  const none=await doReq(remote,'/v1/staging/rider/history',{authorization:null});
  assert.equal(none.status,401);
  assert.equal(calls.length,0,'unauthorized traffic must never hit G4');
 });
});
test('Only approved Admin web origin gets CORS preflight and explicit safe headers',async()=>{
 await withServers(async({remote,calls})=>{
  const invalid=await doReq(remote,'/v1/staging/admin/rides/80800000-0000-4808-8808-000000000001/f1-verification',
   {method:'OPTIONS',headers:{origin:'https://bad.example',
    'access-control-request-method':'GET'}});
  assert.equal(invalid.status,403);
  const preflight=await doReq(remote,
   '/v1/staging/admin/rides/80800000-0000-4808-8808-000000000001/f1-verification',
   {method:'OPTIONS',authorization:null,headers:{origin:browser,
    'access-control-request-method':'GET',
    'access-control-request-headers':'authorization'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),browser);
  const browserRead=await doReq(remote,
   '/v1/staging/admin/rides/80800000-0000-4808-8808-000000000001/f1-verification',
   {headers:{origin:browser}});
  assert.equal(browserRead.status,200);
  assert.equal(browserRead.headers.get('access-control-allow-origin'),browser);
  assert.equal(calls.length,1);
  assert.equal(calls[0].origin,undefined,'never forward untrusted Origin into G4');
 });
});
test('Malformed route, GET bodies, POST JSON and unknown methods never hit G4',async()=>{
 await withServers(async({remote,calls})=>{
  assert.equal((await doReq(remote,'/v1/staging/rider/auto/book?test=1')).status,404);
  assert.equal((await doReq(remote,'/v1/staging/%2e%2e/rider')).status,404);
  assert.equal((await doReq(remote,'/v1/staging/rider/history',
   {body:'x',headers:{'content-length':'1'}})).status,400);
  assert.equal((await doReq(remote,'/v1/staging/rider/auto/book',{
   method:'POST',body:'{"x":1}',headers:{'content-type':'text/plain'}
  })).status,415);
  assert.equal((await doReq(remote,'/v1/staging/rider/auto/book',{
   method:'POST',body:'{bad}',headers:{'content-type':'application/json'}
  })).status,400);
  assert.equal(calls.length,0);
 });
});
test('Render /_qore/liveness confirms process only; no trip readiness claim',async()=>{
 await withServers(async({remote,calls})=>{
  const response=await doReq(remote,'/_qore/liveness',{authorization:null});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
   state:'PROCESS_UP_ONLY',commercialRidesEnabled:false});
  assert.equal(calls.length,0);
 });
});
test('Render ingress fail-closed on untrusted, non-JSON and oversized upstream responses',async()=>{
 for(const answer of [
  {status:200,json:false,text:'<html>bad</html>'},
  {status:200,json:false,text:'x'.repeat(33000)}
 ]){
  const server=createRenderStagingIngress({
   loopbackOrigin:'http://127.0.0.1:10004',expectedHost:host,
   request:async()=>new Response(answer.text,{status:answer.status})
  });
  const remote=await listening(server);
  try{
   const response=await doReq(remote,'/v1/staging/rider/history');
   assert.equal(response.status,503);
   assert(!JSON.stringify(await response.json()).includes(token));
  }finally{await new Promise(done=>server.close(done));}
 }
});
test('G26 second-page history cursor reaches private G4 without query or token leakage',async()=>{
 await withServers(async({remote,calls})=>{
  const cursor='v1.'+'a'.repeat(56)+'.'+'b'.repeat(43);
  const page=await doReq(remote,'/v1/staging/rider/history',{
   headers:{'x-qore-history-cursor':cursor}
  });
  assert.equal(page.status,200);
  await page.json();
  assert.equal(calls.length,1);
  assert.equal(calls[0].cursor,cursor);
  assert.equal(calls[0].auth,'Bearer '+token);
  assert.equal(calls[0].path,'/v1/staging/rider/history');
  for(const headers of [
   {'x-qore-history-cursor':'v1.bad.invalid'},
   {'x-qore-history-cursor':cursor+'%0a'},
   {'x-qore-history-cursor':[cursor,cursor]}
  ]){
   const denied=await doReq(remote,'/v1/staging/rider/history',{headers});
   assert.equal(denied.status,400);
  }
  const other=await doReq(remote,'/v1/staging/driver/inbox',{
   headers:{'x-qore-history-cursor':cursor}
  });
  assert.equal(other.status,400);
  assert.equal(calls.length,1,'No malformed/cross-route cursor reaches G4');
  const firstPage=await doReq(remote,'/v1/staging/rider/history');
  assert.equal(firstPage.status,200);
  await firstPage.json();
  assert.equal(calls[1].cursor,undefined,'First-page request forwards no cursor');
 });
});
test('Render ingress imposes bounded request rate independent of phone retries',async()=>{
 const server=createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:10004',expectedHost:host,now:()=>100000,
  request:async()=>new Response('{"ok":true}',{status:200})
 });
 const remote=await listening(server);
 try{
  for(let i=0;i<90;i++){
   const response=await doReq(remote,'/v1/staging/rider/history');
   assert.equal(response.status,200,'allowed '+i);
   await response.arrayBuffer();
  }
  assert.equal((await doReq(remote,'/v1/staging/rider/history')).status,429);
 }finally{await new Promise(done=>server.close(done));}
});
test('G193 bounded Render ingress refuses a streaming 64KB G4 response before buffering it',async()=>{
 let canceled=false;
 const oversized=new ReadableStream({
  pull(controller){controller.enqueue(new Uint8Array(65536));},
  cancel(){canceled=true;}
 });
 const server=createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:10004',expectedHost:host,
  request:async()=>({status:200,redirected:false,body:oversized})
 });
 const remote=await listening(server);
 try{
  const response=await doReq(remote,'/v1/staging/rider/history');
  assert.equal(response.status,503);
  assert.equal(canceled,true,'oversized upstream must be cancelled');
  const dto=await response.json();
  assert(!JSON.stringify(dto).includes(token));
 }finally{await new Promise(done=>server.close(done));}
});
test('G194 configurable 64-read test budget rejects overload and frees slots',async()=>{
 const pending=[];
 let signalCount=0;
 const server=createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:10004',expectedHost:host,now:()=>100000,
  maxConcurrentReads:64,
  request:async(_url,opts)=>new Promise(resolve=>{
   signalCount++;pending.push({resolve,signal:opts.signal});
  })
 });
 const remote=await listening(server);
 try{
  const requests=Array.from({length:64},()=>doReq(remote,'/v1/staging/rider/history'));
  const until=Date.now()+5000;
  while(signalCount<64&&Date.now()<until)
   await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(signalCount,64,'all slots have reached upstream');
  const overloaded=await doReq(remote,'/v1/staging/rider/history');
  assert.equal(overloaded.status,503);
  assert.equal(signalCount,64,'overload is rejected before G4');
  pending.forEach(({resolve})=>resolve(new Response('{"ok":true}',{status:200})));
  for(const response of await Promise.all(requests)){
   assert.equal(response.status,200);
   assert.deepEqual(await response.json(),{ok:true});
  }
  const final=doReq(remote,'/v1/staging/rider/history');
  while(signalCount<65&&Date.now()<until)
   await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(signalCount,65,'released slots are reusable');
  pending[64].resolve(new Response('{"ok":true}',{status:200}));
  assert.equal((await final).status,200);
 }finally{
  pending.forEach(({resolve})=>resolve(new Response('{"error":"shutdown"}',{status:503})));
  await new Promise(done=>server.close(done));
 }
});

test('G194 removes the 64-total ceiling: 80 GETs and 32 POSTs overlap without rejection',async()=>{
 const pending=[];
 const server=createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:10004',expectedHost:host,
  request:async(_url,opts)=>new Promise(resolve=>{
   pending.push({resolve,method:opts.method});
  })
 });
 const remote=await listening(server);
 const unique=i=>'Bearer '+'g194_unique_credential_'.padEnd(30,'x')+String(i);
 try{
  const reads=Array.from({length:80},(_,i)=>doReq(remote,
   '/v1/staging/rider/history',{authorization:unique(i)}));
  const until=Date.now()+10000;
  while(pending.length<80&&Date.now()<until)
   await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(pending.length,80,'GET lane admits more than old total 64');
  const posts=Array.from({length:32},(_,i)=>doReq(remote,
   '/v1/staging/rider/auto/prequote',{method:'POST',
    authorization:unique(100+i),headers:{'content-type':'application/json'},
    body:JSON.stringify({originalRequestKey:'g194-qa-only-'+i})}));
  while(pending.length<112&&Date.now()<until)
   await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(pending.length,112,'writes not starved by active reads');
  assert.equal(pending.filter(x=>x.method==='POST').length,32);
  pending.forEach(x=>x.resolve(new Response('{"qaOnly":true}',{status:200})));
  for(const response of await Promise.all([...reads,...posts])){
   assert.equal(response.status,200);
   assert.equal((await response.json()).qaOnly,true);
  }
 }finally{
  pending.forEach(x=>x.resolve(new Response('{"qaOnly":true}',{status:503})));
  await new Promise(done=>server.close(done));
 }
});
test('G194 identity capacity serves known owners while full; new users allowed after expiry',async()=>{
 let clock=100000;
 const server=createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:10004',expectedHost:host,
  maxIdentityBuckets:3,now:()=>clock,
  request:async()=>new Response('{"qaOnly":true}',{status:200})
 });
 const remote=await listening(server);
 const key=i=>'Bearer '+'auth_scope_'.padEnd(30,'q')+i;
 try{
  for(let i=0;i<3;i++)
   assert.equal((await doReq(remote,'/v1/staging/rider/history',
    {authorization:key(i)})).status,200);
  const fourth=await doReq(remote,'/v1/staging/rider/history',
   {authorization:key(3)});
  assert.equal(fourth.status,503);
  assert.equal(fourth.headers.get('retry-after'),'1');
  assert.equal((await doReq(remote,'/v1/staging/rider/history',
   {authorization:key(0)})).status,200,
   'full identity map must NOT lock out already admitted owner');
  clock+=60001;
  assert.equal((await doReq(remote,'/v1/staging/rider/history',
   {authorization:key(3)})).status,200,
   'expired identities are evicted at the insertion-order head');
 }finally{await new Promise(done=>server.close(done));}
});
test('G194 rejects dangerous per-instance budgets rather than promising unlimited capacity',()=>{
 const original={loopbackOrigin:'http://127.0.0.1:10004',expectedHost:host};
 for(const override of [
  {maxConcurrentReads:0},{maxConcurrentReads:2049},
  {maxConcurrentWrites:0},{maxConcurrentWrites:1025},
  {maxIdentityBuckets:0},{maxIdentityBuckets:65537},
  {maxConcurrentReads:'unlimited'},{maxConcurrentWrites:Infinity}
 ])assert.throws(()=>createRenderStagingIngress({...original,...override}));
});

test('G193 Render Blueprint pins approved GitHub integration, STAGING only, zero auto deployments',()=>{
 const manifest=readFileSync(new URL('../../../render.yaml',import.meta.url),'utf8');
 assert.match(manifest,/branch: integration\/qore-mobile-e2e-four-apps-20261027/);
 assert.match(manifest,/autoDeployTrigger: off/);
 assert.match(manifest,/QORE_RENDER_NO_COMMERCIAL_TRIPS\s*\n\s*value: "true"/);
 assert.match(manifest,/LIVE_TRIPS_ENABLED\s*\n\s*value: "false"/);
 assert.match(manifest,/QORE_RENDER_STAGING_APPROVED\s*\n\s*sync: false/);
 assert.match(manifest,/QORE_STAGING_SERVICE_ROLE_KEY\s*\n\s*sync: false/);
 assert(!manifest.includes('password:'));
 assert(!manifest.includes('value: "true"\n      - key: LIVE_TRIPS_ENABLED'));
});
const runner=fileURLToPath(new URL('./run-g4-render-staging.mjs',import.meta.url));
const spawn=vars=>spawnSync(process.execPath,[runner],{
 timeout:5000,encoding:'utf8',env:{PATH:process.env.PATH??'/usr/bin',...vars}
});
test('Render runner refuses unapproved staging and commercial flags before any server',()=>{
 for(const vars of [
  {},
  {QORE_RENDER_STAGING_APPROVED:'true'},
  {QORE_RENDER_STAGING_APPROVED:'true',QORE_MOBILITY_ENV:'staging',
   LIVE_TRIPS_ENABLED:'true',QORE_RENDER_NO_COMMERCIAL_TRIPS:'true'}
 ]){
  const res=spawn(vars);
  assert.notEqual(res.status,0);
  assert.match(res.stderr,/explicit non-commercial owner authorization/);
  assert.doesNotMatch(res.stdout,/started|secret|token/);
 }
});
test('G194 Render runner blocks unlimited and malformed concurrency env before privileged clients',()=>{
 const approved={
  QORE_RENDER_STAGING_APPROVED:'true',QORE_MOBILITY_ENV:'staging',
  LIVE_TRIPS_ENABLED:'false',QORE_RENDER_NO_COMMERCIAL_TRIPS:'true',
  PORT:'10000',QORE_RENDER_HOSTNAME:host
 };
 for(const override of [
  {QORE_EDGE_MAX_READS:'0'},
  {QORE_EDGE_MAX_READS:'2049'},
  {QORE_EDGE_MAX_WRITES:'1025'},
  {QORE_EDGE_MAX_IDENTITIES:'65537'},
  {QORE_EDGE_MAX_READS:'unlimited'},
  {QORE_EDGE_MAX_WRITES:'1.5'}
 ]){
  const result=spawn({...approved,...override});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/STAGING admission budget/);
  assert.doesNotMatch(result.stdout,/transport started|secret|token/);
 }
});
test('Render runner with explicitly allowed STAGING still fails closed on missing IdP/PG secrets',()=>{
 const result=spawn({QORE_RENDER_STAGING_APPROVED:'true',
  QORE_MOBILITY_ENV:'staging',LIVE_TRIPS_ENABLED:'false',
  QORE_RENDER_NO_COMMERCIAL_TRIPS:'true',PORT:'10000',
  QORE_RENDER_HOSTNAME:host});
 assert.notEqual(result.status,0);
 assert.doesNotMatch(result.stdout,/transport started/);
});
