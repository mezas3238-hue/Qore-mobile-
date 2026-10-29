/**
 * G171: 2 independently listening existing ingress replicas share real Redis.
 * No network destination except disposable loopback Redis/G4 HTTP.
 * This tests real atomic server-side quotas, restart recovery and fail-closed.
 * No PG, no verified JWT or real orders in this lab stage.
 */
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {createRenderStagingIngress}
 from '../../server/render-staging-ingress.mjs';
import {createG171DistributedQuota,hashG171Credential,
 connectG171StagingRedis} from '../../server/g171-redis-distributed-quota.mjs';
if(process.env.CI!=='true'||process.env.QORE_LAB_G171_REDIS!=='true')
 throw Error('G171 only authorized disposable CI');
const HOST='qore-isolated-load-lab.onrender.com';
const PATH='/v1/staging/driver/inbox';
const TOKEN='Bearer '+'A'.repeat(44);
const redisUrl='redis://127.0.0.1:6379';
const clients=[],servers=[];let reached=0;
async function replica(){
 const client=await connectG171StagingRedis({url:redisUrl});
 clients.push(client);
 const ingress=createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:18080',expectedHost:HOST,
  distributedQuota:createG171DistributedQuota({redisClient:client}),
  request:async()=>{reached++;return{
   status:200,redirected:false,text:async()=>JSON.stringify({
    qaOnly:true,productionEnabled:false,origin:'MOCK_NO_DB'
   })
  };}
 });
 ingress.listen(0,'127.0.0.1');
 await once(ingress,'listening');
 servers.push(ingress);
 return ingress.address().port;
}
function call(port,method='GET',token=TOKEN){
 return new Promise((resolve,reject)=>{
  const req=httpRequest({
   hostname:'127.0.0.1',port,path:PATH,method,
   headers:{host:HOST,'x-forwarded-proto':'https',
    authorization:token,
    ...(method==='POST'?{'content-type':'application/json',
     'content-length':'2'}:{})}
  },res=>{
   const body=[];
   res.on('data',chunk=>body.push(chunk));
   res.on('end',()=>{
    try{resolve({status:res.statusCode,
     body:JSON.parse(Buffer.concat(body).toString('utf8')),
     retryAfter:res.headers['retry-after']});}
    catch(error){reject(error);}
   });
   res.on('error',reject);
  });
  req.on('error',reject);
  if(method==='POST')req.write('{}');
  req.end();
 });
}
const counts=values=>values.reduce((a,v)=>{
 a[v.status]=(a[v.status]??0)+1;return a;
},{});
try{
 const a=await replica(),b=await replica();
 assert.equal(hashG171Credential(TOKEN).length,64);
 const results=await Promise.all(Array.from({length:100},(_,i)=>
  call(i%2?a:b)));
 const seen=counts(results);
 assert.deepEqual(seen,{200:90,429:10},JSON.stringify(seen));
 assert.equal(reached,90,'no denied token crossed ingress boundary');
 assert(results.filter(x=>x.status===429).every(x=>
  Number(x.retryAfter)>=1),'shared 429 has Retry-After');
 assert.equal((await call(a)).status,429);
 assert.equal((await call(b)).status,429);
 // POST quota has a separate 20/60s fixed window; neither GET nor a
 // same-credential retry can manufacture an accepted mutation.
 const posts=await Promise.all(Array.from({length:26},(_,i)=>
  call(i%2?a:b,'POST')));
 assert.deepEqual(counts(posts),{200:20,429:6});
 assert.equal(reached,110);
 // Restarting one ingress leaves the Redis state intact.
 await new Promise(resolve=>servers[0].close(resolve));
 const restarted=await replica();
 assert.equal((await call(restarted)).status,429);
 assert.equal((await call(restarted,'POST')).status,429);
 // The other replica stays usable for another credential.
 assert.equal((await call(b,'GET','Bearer '+'B'.repeat(44))).status,200);
 // A lost coordinator must DENY, never treat local quota as authority.
 await clients[1].disconnect();
 const disconnected=await call(b,'GET','Bearer '+'C'.repeat(44));
 assert.equal(disconnected.status,503);
 assert.equal(disconnected.body.retrySafe,false);
 assert.equal(reached,111,'no Redis-unavailable request reached G4');
 console.log(JSON.stringify({lab:'G171_REDISTRIBUTED_INGRESS',
  realRedis:true,ingressReplicas:3,restarted:true,
  get:seen,post:counts(posts),upstreamReached:reached,
  redisUnavailableHttp:disconnected.status,
  userIdentity:'SYNTHETIC_NOT_VERIFIED',
  database:'NOT_EXERCISED',productionReadiness:'NOT_CERTIFIED',
  verdict:'LOCAL_MULTIREPLICA_REDIS_PASS'}));
}finally{
 await Promise.allSettled(servers.filter(x=>x.listening).map(x=>
  new Promise(resolve=>x.close(resolve))));
 await Promise.allSettled(clients.filter(x=>x.isOpen).map(x=>x.quit()));
}
