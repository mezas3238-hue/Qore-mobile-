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
// Per-replica budgets are operator-tunable only after real capacity tests.
// Reject unlimited, nonnumeric, or out-of-range values before any Auth/PG.
function boundedEnv(name,defaultValue,max){
 const raw=process.env[name];
 if(raw===undefined)return defaultValue;
 if(!/^[1-9][0-9]{0,4}$/.test(raw))throw Error('Invalid STAGING admission budget '+name);
 const value=Number(raw);
 if(!Number.isSafeInteger(value)||value>max)
  throw Error('Unsafe STAGING admission budget '+name);
 return value;
}
const readinessKey=process.env.QORE_STAGING_READINESS_KEY;
if(typeof readinessKey!=='string'||!(/^[A-Za-z0-9_-]{48,128}$/).test(readinessKey)||
   [process.env.QORE_STAGING_SERVICE_ROLE_KEY,
    process.env.QORE_STAGING_PUBLISHABLE_KEY,
    process.env.QORE_HISTORY_CURSOR_SIGNING_KEY].includes(readinessKey))
 throw Error('Private STAGING readiness credential required');
const admission={
 maxConcurrentReads:boundedEnv('QORE_EDGE_MAX_READS',256,2048),
 maxConcurrentWrites:boundedEnv('QORE_EDGE_MAX_WRITES',128,1024),
 maxIdentityBuckets:boundedEnv('QORE_EDGE_MAX_IDENTITIES',32768,65536)
};
// Validate host/origin BEFORE initializing any privileged clients.
createRenderStagingIngress({
 loopbackOrigin:'http://127.0.0.1:4242',expectedHost:hostname,adminOrigin,
 readinessKey,...admission
});
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
const localOrigin=await listenQoreRadarLoopback(runtime.server);
const ingress=createRenderStagingIngress({
 loopbackOrigin:localOrigin,expectedHost:hostname,adminOrigin,
 readinessKey,readinessProbe:runtime.readinessProbe,...admission
});
const shutdown=()=>{
 ingress.close();
 runtime.server.close();
};
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
ingress.listen(port,'0.0.0.0');
await once(ingress,'listening');
console.log('QORE Render STAGING transport started (non-commercial, protected host); no LIVE routes enabled');
