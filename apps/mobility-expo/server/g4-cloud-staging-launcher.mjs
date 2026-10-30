/**
 * Shared non-commercial STAGING startup for Render or Railway.
 * Deployments are never triggered by importing or committing this module.
 * Provider-scoped authorization is required before Supabase clients are created.
 */
import {once} from 'node:events';
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createRenderStagingIngress} from './render-staging-ingress.mjs';

function boundedEnv(env,name,defaultValue,max){
 const raw=env[name];
 if(raw===undefined)return defaultValue;
 if(!/^[1-9][0-9]{0,4}$/.test(raw))throw Error('Invalid STAGING admission budget '+name);
 const value=Number(raw);
 if(!Number.isSafeInteger(value)||value>max)
  throw Error('Unsafe STAGING admission budget '+name);
 return value;
}
export function resolveQoreCloudStagingConfig(provider,env=process.env){
 if(provider!=='render'&&provider!=='railway')throw Error('Unknown STAGING provider');
 const upper=provider.toUpperCase();
 if(env['QORE_'+upper+'_STAGING_APPROVED']!=='true'||
    env.QORE_MOBILITY_ENV!=='staging'||
    env.LIVE_TRIPS_ENABLED!=='false'||
    env['QORE_'+upper+'_NO_COMMERCIAL_TRIPS']!=='true'||
    (provider==='railway'&&env.RAILWAY_ENVIRONMENT_NAME!=='staging'))
  throw Error(upper+' STAGING requires explicit non-commercial owner authorization');
 const port=Number(env.PORT);
 if(!Number.isInteger(port)||port<1024||port>65535)
  throw Error(upper+' STAGING requires an explicit valid PORT');
 const hostname=env['QORE_'+upper+'_HOSTNAME'];
 if(typeof hostname!=='string'||!hostname)
  throw Error(upper+' STAGING pinned hostname required');
 const admission={
  maxConcurrentReads:boundedEnv(env,'QORE_EDGE_MAX_READS',256,2048),
  maxConcurrentWrites:boundedEnv(env,'QORE_EDGE_MAX_WRITES',128,1024),
  maxIdentityBuckets:boundedEnv(env,'QORE_EDGE_MAX_IDENTITIES',32768,65536)
 };
 const readinessKey=env.QORE_STAGING_READINESS_KEY;
 if(typeof readinessKey!=='string'||!/^[A-Za-z0-9_-]{48,128}$/.test(readinessKey)||
    [env.QORE_STAGING_SERVICE_ROLE_KEY,env.QORE_STAGING_PUBLISHABLE_KEY,
     env.QORE_HISTORY_CURSOR_SIGNING_KEY].includes(readinessKey))
  throw Error('Private STAGING readiness credential required');
 const adminOrigin=env.QORE_ADMIN_BROWSER_ORIGIN||null;
 // Validate exact provider domain and HTTPS trust BEFORE privileged Auth/PG.
 createRenderStagingIngress({
  loopbackOrigin:'http://127.0.0.1:4242',
  expectedHost:hostname,adminOrigin,readinessKey,edgeProvider:provider,
  ...admission
 }).close();
 return {provider,port,hostname,adminOrigin,readinessKey,admission};
}
export async function startQoreG4CloudStaging(provider){
 const {port,hostname,adminOrigin,readinessKey,admission}=
  resolveQoreCloudStagingConfig(provider);
 const {createClient}=await import('@supabase/supabase-js');
 const runtime=await prepareQoreG4StagingRuntime({
  environment:'staging',liveTripsEnabled:false,allowQa:true,
  projectRef:process.env.QORE_STAGING_PROJECT_REF,
  anonKey:process.env.QORE_STAGING_PUBLISHABLE_KEY,
  serviceKey:process.env.QORE_STAGING_SERVICE_ROLE_KEY,
  historyCursorSecrets:{
   current:process.env.QORE_HISTORY_CURSOR_SIGNING_KEY,
   previous:process.env.QORE_HISTORY_CURSOR_PREVIOUS_KEY||undefined
  },createClient
 });
 const localOrigin=await listenQoreRadarLoopback(runtime.server);
 const ingress=createRenderStagingIngress({
  loopbackOrigin:localOrigin,expectedHost:hostname,adminOrigin,
  readinessKey,readinessProbe:runtime.readinessProbe,
  edgeProvider:provider,...admission
 });
 const shutdown=()=>{
  ingress.close();
  runtime.server.close();
 };
 process.on('SIGTERM',shutdown);
 process.on('SIGINT',shutdown);
 ingress.listen(port,'0.0.0.0');
 await once(ingress,'listening');
 console.log('QORE '+provider+' STAGING transport started (non-commercial, protected host); no LIVE routes enabled');
}
