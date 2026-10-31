import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as requestHttp} from 'node:http';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRailwayStagingIngress} from './railway-staging-ingress.mjs';

const HOST='qore-mobile-staging.up.railway.app';
const ADMIN='https://movete-admin.example.org';
const TOKEN='g229-verifiable-bearer-000000000000000000';
async function listen(s){s.listen(0,'127.0.0.1');await once(s,'listening');
 return 'http://127.0.0.1:'+s.address().port;}
function call(base,path,{method='GET',headers={},auth=TOKEN,body}={}){
 return new Promise((resolve,reject)=>{
  const req=requestHttp(base+path,{method,headers:{
   host:HOST,'x-forwarded-proto':'https',
   ...(auth===null?{}:{authorization:'Bearer '+auth}),
   ...(body===undefined?{}:{'content-length':String(Buffer.byteLength(body))}),
   ...headers
  }},res=>{const chunks=[];res.on('data',d=>chunks.push(d));
   res.once('error',reject);res.once('end',()=>resolve({
    status:res.statusCode,json:()=>JSON.parse(Buffer.concat(chunks).toString())
   }));});
  req.once('error',reject);if(body!==undefined)req.write(body);req.end();
 });
}
test('G229 Railway ingress pins a single TLS hostname and refuses Render, localhost or custom targets',()=>{
 for(const host of ['qore-mobile-staging.onrender.com','localhost','evil.up.railway.app.evil.test',
   'other.railway.app','a.b.up.railway.app']){
  assert.throws(()=>createRailwayStagingIngress({
   loopbackOrigin:'http://127.0.0.1:4343',expectedHost:host
  }));
 }
 const server=createRailwayStagingIngress({
  loopbackOrigin:'http://127.0.0.1:4343',expectedHost:HOST
 });
 server.close();
});
test('G229 same backend for Cliente, Driver, Comercio, Admin without changing original request identity',async()=>{
 const calls=[];
 const internal=createServer((req,res)=>{
  calls.push({method:req.method,path:req.url,authorization:req.headers.authorization});
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({sameServiceId:'g229-original-demo-id',commercialReady:false}));
 });
 const loopback=await listen(internal);
 const edge=createRailwayStagingIngress({loopbackOrigin:loopback,
  expectedHost:HOST,adminOrigin:ADMIN});
 const remote=await listen(edge);
 try{
  const paths=['/v1/staging/rider/history','/v1/staging/driver/inbox',
   '/v1/staging/merchant/orders','/v1/staging/admin/rides'];
  for(const path of paths){
   const reply=await call(remote,path);
   assert.equal(reply.status,200);
   assert.equal((await reply.json()).sameServiceId,'g229-original-demo-id');
  }
  const radius=await call(remote,'/v1/staging/driver/pickup-preferences',{
   method:'PUT',headers:{'content-type':'application/json'},
   body:JSON.stringify({serviceKind:'RIDE',maximumRoadMeters:0,expectedRevision:1})
  });
  assert.equal(radius.status,200);
  assert.equal((await call(remote,'/v1/staging/rider/history',{
   method:'PUT',headers:{'content-type':'application/json'},body:'{}'
  })).status,404);
  assert.deepEqual(calls.map(x=>x.path),[...paths,
   '/v1/staging/driver/pickup-preferences']);
  assert(calls.every(x=>x.authorization==='Bearer '+TOKEN));
  assert.equal((await call(remote,paths[0],{headers:{host:'evil.up.railway.app'}})).status,403);
  assert.equal((await call(remote,paths[0],{headers:{'x-forwarded-proto':'http'}})).status,403);
  assert.equal((await call(remote,paths[0],{auth:null})).status,401);
  assert.equal(calls.length,5);
  const live=await call(remote,'/_qore/liveness',{auth:null});
  assert.equal(live.status,200);
  assert.deepEqual(await live.json(),{state:'PROCESS_UP_ONLY',commercialRidesEnabled:false});
 }finally{
  await new Promise(done=>edge.close(done));
  await new Promise(done=>internal.close(done));
 }
});
const runner=fileURLToPath(new URL('./run-g4-railway-staging.mjs',import.meta.url));
const run=env=>spawnSync(process.execPath,[runner],{
 encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH??'/usr/bin',...env}
});
test('G229 Railway runner refuses LIVE, production environment, invalid budgets, missing Supabase',()=>{
 const safe={QORE_RAILWAY_STAGING_APPROVED:'true',
  QORE_MOBILITY_ENV:'staging',LIVE_TRIPS_ENABLED:'false',
  QORE_RAILWAY_NO_COMMERCIAL_TRIPS:'true',
  RAILWAY_ENVIRONMENT_NAME:'STAGING',PORT:'8080',QORE_RAILWAY_HOSTNAME:HOST};
 for(const env of [
  {},{...safe,RAILWAY_ENVIRONMENT_NAME:'production'},
  {...safe,LIVE_TRIPS_ENABLED:'true'},
  {...safe,QORE_RAILWAY_HOSTNAME:'evil.onrender.com'},
  {...safe,QORE_EDGE_MAX_READS:'unlimited'}
 ]){
  const result=run(env);assert.notEqual(result.status,0);
  assert.doesNotMatch(result.stdout,/transport ready/);
 }
 const missing=run(safe);assert.notEqual(missing.status,0);
 assert.doesNotMatch(missing.stdout,/transport ready/);
});

test('G230 C/D independent synthetic JWT actors reach one service ID without cross-role access',async()=>{
 const id='23000000-0000-4230-8230-000000000001';
 const roles=[
  ['passenger','/v1/staging/rider/history'],
  ['driver','/v1/staging/driver/inbox'],
  ['merchant','/v1/staging/merchant/23000000-0000-4230-8230-000000000002/orders/inbox'],
  ['admin','/v1/staging/admin/services/AUTO_RIDE/'+id+'/trace']
 ];
 const token=role=>'g230_test_actor_'+role.padEnd(28,'x');
 const upstream=createServer((req,res)=>{
  const role=roles.find(([name])=>req.headers.authorization==='Bearer '+token(name))?.[0];
  const allowed=roles.find(([_,path])=>path===req.url)?.[0];
  const status=role===allowed?200:403;
  res.writeHead(status,{'content-type':'application/json'});
  res.end(JSON.stringify(status===200?{
   serviceId:id,productionEnabled:false,serverPersisted:false,
   actorRole:role,qaOnly:true
  }:{error:'SYNTHETIC_ROLE_FORBIDDEN',productionEnabled:false}));
 });
 const local=await listen(upstream);
 const edge=createRailwayStagingIngress({
  loopbackOrigin:local,expectedHost:HOST,adminOrigin:ADMIN
 });
 const url=await listen(edge);
 try{
  for(const [role,path] of roles){
   const own=await call(url,path,{auth:token(role)});
   assert.equal(own.status,200,role);
   assert.deepEqual(await own.json(),{
    serviceId:id,productionEnabled:false,serverPersisted:false,
    actorRole:role,qaOnly:true
   });
   const foreign=await call(url,path,{auth:token(role==='driver'?'admin':'driver')});
   assert.equal(foreign.status,403,'wrong actor '+role);
  }
 }finally{
  await new Promise(done=>edge.close(done));
  await new Promise(done=>upstream.close(done));
 }
});
