/** Dedicated OS process for G171 multi-instance Redis replay and crash tests. */
import {once} from 'node:events';
import {createRenderStagingIngress}
 from '../../server/render-staging-ingress.mjs';
import {createG171DistributedQuota,connectG171StagingRedis}
 from '../../server/g171-redis-distributed-quota.mjs';
if(process.env.CI!=='true'||process.env.QORE_LAB_G171_REDIS!=='true'||
 typeof process.send!=='function')
 throw Error('G171 worker only authorized CI subprocess');
const client=await connectG171StagingRedis({url:'redis://127.0.0.1:6379'});
const server=createRenderStagingIngress({
 loopbackOrigin:'http://127.0.0.1:18080',
 expectedHost:'qore-isolated-load-lab.onrender.com',
 distributedQuota:createG171DistributedQuota({redisClient:client}),
 request:async()=>({status:200,redirected:false,
  text:async()=>JSON.stringify({
   qaOnly:true,productionEnabled:false,mode:'SYNTHETIC_HTTP_ONLY'
  })})
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
process.send({type:'READY',port:server.address().port});
process.on('message',message=>{
 if(message?.type==='STOP'){
  void (async()=>{
   await new Promise(resolve=>server.close(resolve));
   await client.quit();process.exit(0);
  })();
 }
});
