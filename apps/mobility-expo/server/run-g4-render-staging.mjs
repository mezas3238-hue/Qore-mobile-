/**
 * Explicit Render STAGING entrypoint. No deployment is triggered by this file.
 * G4 is still localhost only; the network-facing adapter owns the HTTPS
 * reverse-proxy boundary, while G4 owns bearer/role/revocation/SQL policy.
 * A passing process health probe is not a certified trip or LIVE authorization.
 */
import {once} from 'node:events';
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createRenderStagingIngress} from './render-staging-ingress.mjs';
import {createG171DistributedQuota,connectG171StagingRedis,validateG171RedisEndpoint} from './g171-redis-distributed-quota.mjs';

if(process.env.QORE_RENDER_STAGING_APPROVED!=='true'||
   process.env.QORE_MOBILITY_ENV!=='staging'||
   process.env.LIVE_TRIPS_ENABLED!=='false'||
   process.env.QORE_RENDER_NO_COMMERCIAL_TRIPS!=='true')
 throw Error('Render STAGING requires explicit non-commercial owner authorization');
const port=Number(process.env.PORT);
if(!Number.isInteger(port)||port<1024||port>65535)
 throw Error('Render STAGING requires an explicit valid PORT');
const hostname=process.env.QORE_RENDER_HOSTNAME;
const adminOrigin=process.env.QORE_ADMIN_BROWSER_ORIGIN||null;
if(!hostname)throw Error('Render STAGING pinned hostname required');
// Validate host/origin BEFORE initializing any privileged clients.
createRenderStagingIngress({
 loopbackOrigin:'http://127.0.0.1:4242',expectedHost:hostname,adminOrigin
});
// G176: a multi-instance STAGING configuration cannot silently fall back to
// per-process buckets. Validate all distributed quota config BEFORE building
// privileged Supabase connections or listening on any network interface.
const replicaCount=Number(process.env.QORE_STAGING_REPLICA_COUNT??'1');
if(!Number.isSafeInteger(replicaCount)||replicaCount<1||replicaCount>1000)
 throw Error('G176 invalid STAGING replica count');
const redisEnabled=process.env.QORE_G171_REDIS_QUOTA_ENABLED==='true';
if(!['true','false',undefined].includes(process.env.QORE_G171_REDIS_QUOTA_ENABLED))
 throw Error('G171 invalid Redis opt-in value');
if(replicaCount>1&&!redisEnabled)
 throw Error('G176 multi-instance STAGING requires shared Redis quotas');
const redisEndpoint=redisEnabled?validateG171RedisEndpoint({
 url:process.env.QORE_G171_REDIS_URL,
 privateStagingApproved:process.env.QORE_G171_PRIVATE_REDIS_APPROVED==='true',
 pinnedHostname:process.env.QORE_G171_REDIS_PINNED_HOST??null
}):null;
if(replicaCount>1&&redisEndpoint?.mode!=='OWNER_APPROVED_STAGING_TLS')
 throw Error('G176 multiple hosts require shared pinned TLS Redis; localhost is not distributed');
const {createClient}=await import('@supabase/supabase-js');
const runtime=await prepareQoreG4StagingRuntime({
 environment:'staging',liveTripsEnabled:false,allowQa:true,
 projectRef:process.env.QORE_STAGING_PROJECT_REF,
 anonKey:process.env.QORE_STAGING_PUBLISHABLE_KEY,
 serviceKey:process.env.QORE_STAGING_SERVICE_ROLE_KEY,
 historyCursorSecrets:{
  current:process.env.QORE_HISTORY_CURSOR_SIGNING_KEY,
  previous:process.env.QORE_HISTORY_CURSOR_PREVIOUS_KEY||undefined
 },
 createClient
});
// G171: existing ingress accepts disposable local Redis, or separate
// explicitly Owner-approved STAGING Redis over pinned TLS with ACL.
// Never auto-activate a paid provider, LIVE work or production traffic.
const redisClient=redisEnabled?await connectG171StagingRedis({
 url:process.env.QORE_G171_REDIS_URL,
 privateStagingApproved:process.env.QORE_G171_PRIVATE_REDIS_APPROVED==='true',
 pinnedHostname:process.env.QORE_G171_REDIS_PINNED_HOST??null
}):null;
const distributedQuota=redisClient===null?null:createG171DistributedQuota({
 redisClient
});
const localOrigin=await listenQoreRadarLoopback(runtime.server);
const ingress=createRenderStagingIngress({
 loopbackOrigin:localOrigin,expectedHost:hostname,adminOrigin,distributedQuota,
 readinessProbe:async()=>{
  if(await runtime.probeDependencies()!==true)
   throw Error('G175 Auth/PG unavailable');
  if(redisClient!==null&&await redisClient.ping()!=='PONG')
   throw Error('G175 Redis unavailable');
  return true;
 }
});
const shutdown=()=>{
 ingress.close();
 runtime.server.close();
 if(redisClient!==null)void redisClient.quit().catch(()=>{});
};
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
ingress.listen(port,'0.0.0.0');
await once(ingress,'listening');
console.log('QORE Render STAGING transport started (non-commercial, protected host); no LIVE routes enabled');
