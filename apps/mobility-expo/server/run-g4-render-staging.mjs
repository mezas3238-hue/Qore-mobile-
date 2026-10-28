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
// Validate host/origin BEFORE initializing any privileged clients.
createRenderStagingIngress({
 loopbackOrigin:'http://127.0.0.1:4242',expectedHost:hostname,adminOrigin
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
 loopbackOrigin:localOrigin,expectedHost:hostname,adminOrigin
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
