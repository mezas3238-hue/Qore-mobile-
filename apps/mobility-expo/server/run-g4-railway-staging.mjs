/**
 * QORE G229 Railway STAGING entrypoint. No auto deployment is configured here.
 * Reuse the existing G4 backend and Supabase repositories without copying them.
 * LIVE, paid PSP, public sign-up and synthetic KYC/legal approvals remain closed.
 */
import {once} from 'node:events';
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createRailwayStagingIngress} from './railway-staging-ingress.mjs';

function assertRailwayEnvironment(env){
 if(env.QORE_RAILWAY_STAGING_APPROVED!=='true'||
    env.QORE_MOBILITY_ENV!=='staging'||
    env.LIVE_TRIPS_ENABLED!=='false'||
    env.QORE_RAILWAY_NO_COMMERCIAL_TRIPS!=='true'||
    !/^(staging)$/i.test(env.RAILWAY_ENVIRONMENT_NAME??''))
  throw Error('Railway STAGING requires non-commercial Owner authorization');
 // Never infer recipient session deployment from a plain STAGING flag.
 if(![undefined,'true','false'].includes(env.QORE_G247_RECIPIENT_AUTH_APPROVED))
  throw Error('G249 opt-in must be an explicit boolean string');
 const g247RecipientAuthApproved=env.QORE_G247_RECIPIENT_AUTH_APPROVED==='true';
 if(![undefined,'true','false'].includes(env.QORE_G252_MERCHANT_INBOX_APPROVED))
  throw Error('G252 merchant read-only inbox opt-in must be explicit boolean');
 const g252MerchantInboxAuthApproved=env.QORE_G252_MERCHANT_INBOX_APPROVED==='true';
 const port=Number(env.PORT);
 if(!Number.isInteger(port)||port<1024||port>65535)
  throw Error('Railway STAGING requires a valid PORT');
 const hostname=env.QORE_RAILWAY_HOSTNAME;
 const adminOrigin=env.QORE_ADMIN_BROWSER_ORIGIN||null;
 const bound=(name,def,max)=>{
  const value=env[name];
  if(value===undefined)return def;
  if(!/^[1-9][0-9]{0,4}$/.test(value)||Number(value)>max)
   throw Error('Invalid Railway STAGING admission budget '+name);
  return Number(value);
 };
 const admission={
  maxConcurrentReads:bound('QORE_EDGE_MAX_READS',256,2048),
  maxConcurrentWrites:bound('QORE_EDGE_MAX_WRITES',128,1024),
  maxIdentityBuckets:bound('QORE_EDGE_MAX_IDENTITIES',32768,65536)
 };
 // Reject untrusted public hostname before initializing the service-role SDK.
 createRailwayStagingIngress({
  loopbackOrigin:'http://127.0.0.1:4242',expectedHost:hostname,
  adminOrigin,...admission
 });
 return {port,hostname,adminOrigin,admission,g247RecipientAuthApproved,g252MerchantInboxAuthApproved};
}
const {port,hostname,adminOrigin,admission,g247RecipientAuthApproved,g252MerchantInboxAuthApproved}=assertRailwayEnvironment(process.env);
const {createClient}=await import('@supabase/supabase-js');
const runtime=await prepareQoreG4StagingRuntime({
 environment:'staging',liveTripsEnabled:false,allowQa:true,
 g247RecipientAuthApproved,g252MerchantInboxAuthApproved,
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
const ingress=createRailwayStagingIngress({
 loopbackOrigin:localOrigin,expectedHost:hostname,adminOrigin,...admission
});
const shutdown=()=>{ingress.close();runtime.server.close();};
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
ingress.listen(port,'0.0.0.0');
await once(ingress,'listening');
console.log('QORE Railway STAGING transport ready; no LIVE or commercial authorization');
