/**
 * QORE G229 Railway STAGING entrypoint. No auto deployment is configured here.
 * Reuse the existing G4 backend and Supabase repositories without copying them.
 * LIVE, paid PSP, public sign-up and synthetic KYC/legal approvals remain closed.
 */
import {once} from 'node:events';
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createRailwayStagingIngress} from './railway-staging-ingress.mjs';
import {verifyG256RailwayLaunch} from '../scripts/g256-railway-launch-preflight.mjs';
import {readG282RailwayAutoRetryOptIn,assertG282PrivateBatchInstalled,
 assertG283VerifiedDatabaseReadiness,startG282RailwayRetryWorker}
 from './g282-railway-private-auto-retry-gate.mjs';

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
 if(![undefined,'true','false'].includes(env.QORE_G282_VEHICLE_DRAFT_APPROVED))
  throw Error('G282 vehicle draft opt-in must be explicit boolean');
 const g282VehicleDraftApproved=env.QORE_G282_VEHICLE_DRAFT_APPROVED==='true';
 // Explicit STAGING jurisdiction set by operator only. Never default to
 // Asunción or infer location from client. Absence keeps draft intake closed.
 const g302TrustedMunicipalityCode=env.QORE_G302_STAGING_MUNICIPALITY_CODE??null;
 if(g302TrustedMunicipalityCode!==null&&
    !/^[A-Z0-9_-]{2,60}$/.test(g302TrustedMunicipalityCode))
  throw Error('G302 invalid staging municipality authority');
 if(![undefined,'true','false'].includes(env.QORE_G260_ADMIN_AAL2_APPROVED))
  throw Error('G260 Admin AAL2 trust opt-in must be explicit boolean');
 const g260AdminAal2Approved=env.QORE_G260_ADMIN_AAL2_APPROVED==='true';
 // G268: no Owner fare publication from a mere Admin read-only gate.
 if(![undefined,'true','false'].includes(env.QORE_G268_OWNER_FARE_APPROVED))
  throw Error('G268 Owner fare opt-in must be an explicit boolean string');
 const g268OwnerFareApproved=env.QORE_G268_OWNER_FARE_APPROVED==='true';
 if(g268OwnerFareApproved&&!g260AdminAal2Approved)
  throw Error('G268 Owner fare requires independently approved G260 AAL2');
 const port=Number(env.PORT);
 if(!Number.isInteger(port)||port<1024||port>65535)
  throw Error('Railway STAGING requires a valid PORT');
 const hostname=env.QORE_RAILWAY_HOSTNAME;
 const adminOrigin=env.QORE_ADMIN_BROWSER_ORIGIN||null;
 // G264/G263 browser Admin cannot reach this API without explicit pinned
 // CORS. Forbid toggling the Admin AAL2 gateway into an unreachable or
 // accidentally arbitrary browser origin. Never enable a wildcard origin.
 if(g260AdminAal2Approved&&adminOrigin===null)
  throw Error('G260 Admin AAL2 requires explicit pinned browser HTTPS origin');
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
 return {port,hostname,adminOrigin,admission,
  g247RecipientAuthApproved,g252MerchantInboxAuthApproved,g260AdminAal2Approved,g282VehicleDraftApproved,g302TrustedMunicipalityCode,g268OwnerFareApproved};
}
const {port,hostname,adminOrigin,admission,g247RecipientAuthApproved,
 g252MerchantInboxAuthApproved,g260AdminAal2Approved,g282VehicleDraftApproved,g302TrustedMunicipalityCode,g268OwnerFareApproved}=assertRailwayEnvironment(process.env);
// Repeat the G256 read-only checks at process start: a missing Railway
// pre-deploy hook must never bypass STAGING ownership or public-signup fence.
const g113RetryApproved=readG282RailwayAutoRetryOptIn(process.env);
const g256=await verifyG256RailwayLaunch({env:process.env});
if(!g256.ok)throw Error('G256 staging startup blocked: '+g256.code);
const {createClient}=await import('@supabase/supabase-js');
if(g113RetryApproved){
 // Never trust operator-only READY flags. Both checks are backend-only,
 // explicitly non-dispatching and run before the public Railway listener.
 const db=createClient(
  'https://'+process.env.QORE_STAGING_PROJECT_REF+'.supabase.co',
  process.env.QORE_STAGING_SERVICE_ROLE_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
 );
 const rpc=(name,args)=>db.rpc(name,args);
 await assertG282PrivateBatchInstalled(rpc);
 await assertG283VerifiedDatabaseReadiness(rpc);
}
const runtime=await prepareQoreG4StagingRuntime({
 environment:'staging',liveTripsEnabled:false,allowQa:true,
 g247RecipientAuthApproved,g252MerchantInboxAuthApproved,g260AdminAal2Approved,g282VehicleDraftApproved,g302TrustedMunicipalityCode,g268OwnerFareApproved,
 autoDispatchRetryQa:g113RetryApproved,
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
let retryController=null;
const shutdown=()=>{
 retryController?.stop();
 ingress.close();
 runtime.server.close();
};
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
ingress.listen(port,'0.0.0.0');
await once(ingress,'listening');
try{
 retryController=startG282RailwayRetryWorker({
  worker:runtime.qaAutoDispatchRetry,enabled:g113RetryApproved
 });
}catch{
 shutdown();
 throw Error('G284 cannot start private retry worker; failing closed');
}
console.log('QORE Railway STAGING transport ready; no LIVE or commercial authorization');
