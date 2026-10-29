/**
 * G171 independent OS process proof: two spawned Node ingress replicas,
 * real Redis atomic quota, SIGKILL of one instance and restart.
 * Never calls external URLs or commercial services.
 */
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {fileURLToPath} from 'node:url';
if(process.env.CI!=='true'||process.env.QORE_LAB_G171_REDIS!=='true')
 throw Error('G171 OS-process test only runs in disposable CI');
const worker=fileURLToPath(new URL('./g171-redis-worker-ci.mjs',import.meta.url));
const HOST='qore-isolated-load-lab.onrender.com';
const TOKEN='Bearer '+'D'.repeat(44);
const children=[];
const counts=values=>values.reduce((acc,x)=>{
 acc[x.status]=(acc[x.status]??0)+1;return acc;
},{});
function call(port){
 return new Promise((resolve,reject)=>{
  const req=httpRequest({
   hostname:'127.0.0.1',port,path:'/v1/staging/driver/inbox',method:'GET',
   headers:{host:HOST,'x-forwarded-proto':'https',authorization:TOKEN}
  },res=>{
   const chunks=[];
   res.on('data',x=>chunks.push(x));
   res.on('end',()=>resolve({
    status:res.statusCode,
    body:JSON.parse(Buffer.concat(chunks).toString('utf8'))
   }));
   res.on('error',reject);
  });
  req.on('error',reject);req.end();
 });
}
function spawn(){
 return new Promise((resolve,reject)=>{
  const child=fork(worker,[],{stdio:['ignore','pipe','pipe','ipc'],
   env:{...process.env}});
  children.push(child);
  let settled=false;
  child.on('message',msg=>{
   if(!settled&&msg?.type==='READY'&&
      Number.isSafeInteger(msg.port)&&msg.port>1024){
    settled=true;resolve({child,port:msg.port});
   }
  });
  child.once('exit',(code,signal)=>{
   if(!settled){settled=true;reject(Error('G171 worker startup failed '+code+'/'+signal));}
  });
  child.once('error',err=>{if(!settled){settled=true;reject(err);}});
 });
}
try{
 const first=await spawn(),second=await spawn();
 assert.notEqual(first.child.pid,second.child.pid);
 const reads=await Promise.all(Array.from({length:100},(_,i)=>
  call(i%2?first.port:second.port)));
 assert.deepEqual(counts(reads),{200:90,429:10});
 // Forcefully lose a Node process. Redis holds rate state independently.
 first.child.kill('SIGKILL');
 await once(first.child,'exit');
 const recovered=await spawn();
 assert.notEqual(recovered.child.pid,first.child.pid);
 assert.equal((await call(recovered.port)).status,429);
 assert.equal((await call(second.port)).status,429);
 console.log(JSON.stringify({lab:'G171_REDIS_OS_PROCESS_RESTART',
  independentNodeProcesses:3,realRedis:true,forcedSigkill:true,
  http:counts(reads),afterRestart:429,
  idpVerified:false,postgresqlExercised:false,
  commercialEnabled:false,verdict:'MULTIPROCESS_PASS'}));
}finally{
 await Promise.allSettled(children.map(async child=>{
  if(child.exitCode!==null||child.signalCode!==null)return;
  child.send({type:'STOP'});
  const done=once(child,'exit');
  await Promise.race([done,new Promise(resolve=>setTimeout(resolve,2000))]);
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
 }));
}
